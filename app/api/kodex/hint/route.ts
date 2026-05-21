import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Session, { ISession } from "@/models/Session";
import Problem from "@/models/Problem";
import StudentProfile from "@/models/StudentProfile";
import { determineHintType } from "@/lib/hintRouter";
import { getHintFromGroq } from "@/lib/claude";
import {
  hashCode,
  detectContextDrift,
  codeChangedMeaningfully,
} from "@/lib/codeHash";
import { isKillSwitchActive } from "@/lib/KillSwitch";
import {
  updateStudentProfile,
  buildProfileContext,
} from "@/lib/studentProfile";
import { getQuota, incrementQuota } from "@/lib/redis";
import { getTokenFromRequest } from "@/lib/auth";
import { HINT_CONFIG as C } from "@/lib/hintConfig";
import { validateHintRequest } from "@/lib/validation";
import { env } from "@/lib/env";
import { runTestCases, ExecutionError } from "@/lib/judge";
import type { HintType, HintMode } from "@/types/kodex";
import mongoose from "mongoose";
import { timeStamp } from "console";

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quota = await getQuota(payload.userId, "hint");
  return NextResponse.json({
    quotaRemaining: quota.hintsRemaining,
    dailyLimit: quota.dailyLimit,
  });
}

export async function POST(req: NextRequest) {
  // step1: Auth-----------
  const payload = getTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = payload;

  // STEP 2: VALIDATE BODY-----------
  let rawBody: unknown;
  try {
    rawBody: await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateHintRequest(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const {
    problemSlug,
    userCode,
    language,
    conversationHistory,
    sessionId,
    studentApproach,
    solved,
    reflectionAnswer,
  } = validation.data;

  // STEP 3: DB CONNECTION-----------
  await connectDB();

  // STEP  4: Fetch problem — NEVER expose pattern field-----------
  const problem = await Problem.findOne({ slug: problemSlug })
    .select("-pattern")
    .lean();

  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  // STEP 5: Fetch user---------
  const user = await User.findById(userId).select("-password").lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // STEP 6: Quota Check---------
  const quota = await getQuota(userId, "hint");
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Daily hint quota exhausted",
        quotaRemaining: 0,
        message:
          "You've used all 50 hints for today. Come back tomorrow — " +
          "spacing your practice is part of the process.",
      },
      { status: 429 },
    );
  }
  let quotaRemaining = quota.hintsRemaining;

  // STEP 7: Fetch or create Session---------
  let session: ISession | null = null;

  if (sessionId) {
    session = await Session.findOne({
      _id: sessionId,
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  if (!session) {
    const profile = await StudentProfile.findOne({ userId }).lean();
    const beltSnapshot = profile?.belt ?? user.belt ?? "white";

    session = await Session.create({
      userId: new mongoose.Types.ObjectId(userId),
      problemSlug,
      language,
      beltAtSessionStart: beltSnapshot,
      lastActivitAt: new Date(),
    });
  }
  if (!session) {
    throw new Error("Session initialization failed");
  }

  // STEP 8: Code Hash and Drift Detection---------
  const currentCodeHash = hashCode(userCode);
  const prevHash = session?.currentCodeHash ?? "";
  const contextDriftDetected =
    prevHash !== "" &&
    detectContextDrift(
      (session.codeHistory?.length ?? 0 > 0) ? prevHash : "",
      userCode,
    );
  const codeMeaningfullyChanged = codeChangedMeaningfully(prevHash, userCode);

  // STEP 9: Cooldown check---------
  if (session?.cooldownUntil && new Date() < session.cooldownUntil) {
    const secondsLeft = Math.ceil(
      (session.cooldownUntil.getTime() - Date.now()) / 1000,
    );
    return NextResponse.json({
      hint: `Take ${secondsLeft} more seconds with what you have. The next question will land better if you've tried first.`,
      hintType: "run_first" as HintType,
      isZeroCost: true,
      quotaRemaining,
      sessionId: session._id.toString(),
      hintsGiven: session.hintsGiven,
    });
  }

  // STEP 10: Logic Trap evaluation ---------
  if (session?.logicTrapPending && studentApproach.trim()) {
    const isSubstantiveAnswer = studentApproach.trim().length > 10;
    if (isSubstantiveAnswer) {
      session.logicTrapPending = false;
      session.logicTrapQuestion = null;
    } else {
      return NextResponse.json({
        hint:
          session.logicTrapQuestion ??
          "Walk me through that specific line before we continue.",
        hintType: "logic_trap" as HintType,
        isZeroCost: true,
        quotaRemaining,
        sessionId: session._id.toString(),
        hintsGiven: session.hintsGiven,
      });
    }
  }

  // STEP 11: determineHintType() ---------
  const elapsedMinutes = session?.createdAt
    ? Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 60000)
    : 0;
  const lastExecution = session.lastExecutionResult?.status
    ? {
        status: session.lastExecutionResult.status,
        stderr: session.lastExecutionResult.stderr,
        failedTestInput: session.lastExecutionResult.failedTestInput,
        failedExpected: session.lastExecutionResult.failedExpected,
        failedActual: session.lastExecutionResult.failedActual,
      }
    : null;
  const hintDecision = await determineHintType({
    session: {
      hintsGiven: session.hintsGiven,
      approachValidated: session.approachValidated,
      constraintsCoachDone: session.constraintCoachDone,
      comprehensionCoachDone: session.comprehensionCoachDone,
      lastRunPassed: session.lastRunPassed,
      hiddenTestFailed: session.hiddenTestFailed,
      tleCount: session.tleCount,
      consecutiveSignalCount: session.consecutiveSignalCount,
      isFrustated: session.isFrustrated,
      logicTrapPending: session.logicTrapPending,
      beltAtSessionStart: session.beltAtSessionStart,
      language: session.language,
      currentCodeHash,
      hintTimeStamps: session.hintTimeStamps,
    },
    userCode,
    studentApproach,
    problem: {
      contraints: problem.contraints,
      title: problem.title,
    },
    elapsedMinutes,
    lastExecution,
  });

  // STEP 12: Zero-cost Short Circuits ---------
  if (hintDecision.quotaCost === 0 && hintDecision.message) {
    await Session.findOneAndUpdate(
      {
        _id: session._id,
        userId: new mongoose.Types.ObjectId(userId),
      },
      {
        $set: {
          lastActivityAt: new Date(),
          language,
          userCode,
          currentCodeHash,
        },
        $push: { hintTimeStamps: new Date() },
      },
    );
    return NextResponse.json({
      hint: hintDecision.message,
      hintType: hintDecision.type,
      isZeroCost: true,
      quotaRemaining,
      sessionId: session._id.toString(),
      hintsGiven: session.hintsGiven,
    });
  }

  // STEP 13: Fetch Student Profile ---------
  const studentProfile = await StudentProfile.findOne({ userId }).lean();
  const profileContext = buildProfileContext(studentProfile, {
    knownConcepts: user.knownConcepts ?? [],
    experienceLevel: user.experienceLevel ?? "beginner",
  });

  // STEP 14: Frustration Detection ---------
  const lastActivityGapMin = session.lastActivityAt
    ? Math.floor(
        (Date.now() - new Date(session.lastActivityAt).getTime()) / 60000,
      )
    : 0;
  const isFrustrated =
    elapsedMinutes > C.frustationMinutes &&
    session.hintsGiven > C.frustationMinHints &&
    lastActivityGapMin > C.frustationInactivityMinutes;

  // STEP 15: build Groq Request ---------
  const consecutiveWACount =
    session.consecutiveSignalCount?.get?.("Wrong Answer") ?? 0;
  const groqRequest = {
    problemTitle: problem.title,
    problemDescription: problem.description,
    problemExamples: problem.examples ?? [],
    problemConstraints: problem.contraints,
    userCode: userCode.trim() || "// NO CODE WRITTEN YET",
    language,
    studentApproach,
    hintsGiven: session.hintsGiven,
    approachValidated: session.approachValidated,
    constraintCoachDone: session.constraintCoachDone,
    comprehensionCoachDone: session.comprehensionCoachDone,
    beltAtSessionStart: session.beltAtSessionStart,
    hintType: hintDecision.type,
    currentCodeHash,
    contextDriftDetected,
    lastExecutionStatus: session.lastExecutionResult?.status ?? null,
    compilerStderr: session.lastExecutionResult?.stderr ?? null,
    failedTestInput: session.lastExecutionResult?.failedTestInput ?? null,
    failedExpected: session.lastExecutionResult?.failedExpected ?? null,
    failedActual: session.lastExecutionResult?.failedActual ?? null,
    hasPendingTLE: hintDecision.hasPendingTLE ?? false,
    tleCount: session.tleCount ?? 0,
    consecutiveWACount,
    isFrustrated,
    profileContext,
    conversationHistory,
    solved,
    reflectionAnswer: reflectionAnswer ?? null,
  };

  // STEP 16:  Groq Request ---------
  let groqResponse;
  try {
    groqResponse = await getHintFromGroq(groqRequest);
  } catch (err) {
    console.error("[hint] Groq call failed:", {
      userId,
      sessionId,
      hintType: hintDecision.type,
      err,
    });
    return NextResponse.json({
      hint: "I'm having trouble connecting right now. Try running your code and checking the output — what does it actually do on the first example?",
      hintType: "socratic_default" as HintType,
      isZeroCost: true,
      quotaRemaining,
      sessionId: session._id.toString(),
      hintsGiven: session.hintsGiven,
    });
  }

  // STEP 17:  update consecutive signal count ---------
  const currentSignal = session.lastExecutionResult?.status ?? "none";
  const prevSignalKey = session.consecutiveSignalCount
    ? [...(session.consecutiveSignalCount as Map<string, number>).keys()][0]
    : null;

  const newConsecutiveSignalCount = new Map<string, number>();
  if (currentSignal !== "none") {
    const prevCount = session.consecutiveSignalCount?.get(currentSignal) ?? 0;
    newConsecutiveSignalCount.set(
      currentSignal,
      prevSignalKey === currentSignal ? prevCount + 1 : 1,
    );
  }

  // STEP 18:  Logic Trap State ---------
  let logicTrapPending = session.logicTrapPending;
  let logicTrapQuestion = session.logicTrapQuestion;
  if (hintDecision.type === "logic_trap") {
    logicTrapPending = true;
    logicTrapQuestion = groqResponse.hint;
  }

  // STEP 19:  Gatekeeper Flag Updates ---------
  let constraintCoachDone = session.constraintCoachDone;
  let comprehensionCheckDone = session.comprehensionCoachDone;
  let approachValidated = session.approachValidated;

  if (groqResponse.mode === "constraint_coach") constraintCoachDone = true;
  if (groqResponse.mode === "comprehension_check")
    comprehensionCheckDone = true;
  if (groqResponse.approachIsValid === true) approachValidated = true;

  // STEP 20:  Build hint log entry ---------
  const HintLogEntry = {
    hintNumber: session.hintsGiven + (hintDecision.quotaCost === 1 ? 1 : 0),
    mode: groqResponse.mode as HintMode,
    hintType: hintDecision.type,
    codeStateHash: currentCodeHash,
    aiObservation: groqResponse.hint,
    misconception: groqResponse.misconception ?? null,
    isLateral: groqResponse.isLateral ?? false,
    compilerStats: session.lastExecutionResult?.status ?? null,
    consecutiveSignalAtTime: consecutiveWACount,
    userFeedback: null,
    feedbackAt: null,
    timeStamp: new Date(),
  };

  // STEP 21: POST SOLVE FLOW ---------
  let patternCard = session.patternCard ?? null;
  let structuredReveal = session.structuredReveal ?? null;
  let reflectionQuestion: string | null = null;
  let assistedSolve = session.assistedSolve;

  if (solved) {
    if (!reflectionAnswer) {
      reflectionQuestion = groqResponse.reflectionQuestion;
    } else {
      patternCard = groqResponse.patternCard;
      structuredReveal = groqResponse.structuredReveal;
      if (session.currentMode === "code_correction") assistedSolve = true;
      // Fire and Forget never blocks response
      setImmediate(async () => {
        try {
          await updateStudentProfile(userId, session!._id.toString());
        } catch (err) {
          console.error("Failed to updat student profile");
        }
      });
    }
  }

  // STEP 22: Session save then quota increment ---------
  const savedSession = await Session.findOneAndUpdate(
    {
      _id: session._id,
      userId: new mongoose.Types.ObjectId(userId),
    },
    {
      $set: {
        userCode,
        language,
        studentApproach,
        currentCodeHash,
        contextDriftDetected,
        approachValidated,
        constraintCoachDone,
        comprehensionCheckDone,
        consecutiveSignalCount: newConsecutiveSignalCount,
        currentMode: groqResponse.mode,
        isFrustrated,
        logicTrapPending,
        logicTrapQuestion,
        lastActivityAt: new Date(),
        patternCard,
        structuredReveal,
        assistedSolve,
        reflectionAnswer: reflectionAnswer ?? session.reflectionAnswer,
        ...(solved && { solved: true, status: "solved" }),
        ...(codeMeaningfullyChanged && { lastMeaningfulChangeAt: new Date() }),
      },
      $inc: { hintsGiven: hintDecision.quotaCost === 1 ? 1 : 0 },
      $push: {
        hintTimestamps: new Date(),
        hintLog: HintLogEntry,
        ...(codeMeaningfullyChanged && { codeHistory: currentCodeHash }),
      },
    },
    { new: true },
  );

  if (!savedSession) {
    return NextResponse.json(
      { error: "Failed to save session state — please try again" },
      { status: 500 },
    );
  }

  // Quota increment only after confirmed session save
  if (hintDecision.quotaCost === 1) {
    const used = await incrementQuota(userId, "hint");
    quotaRemaining = Math.max(0, quota.dailyLimit - used);
  }

  // ── Step 23: Return ──────────────────────────────────────
  return NextResponse.json({
    hint: groqResponse.hint,
    hintType: hintDecision.type,
    mode: groqResponse.mode,
    pattern: groqResponse.pattern,
    approachIsValid: groqResponse.approachIsValid,
    patternCard,
    structuredReveal,
    reflectionQuestion,
    tradeoffQuestion: groqResponse.tradeoffQuestion,
    hintsGiven: session.hintsGiven + (hintDecision.quotaCost === 1 ? 1 : 0),
    quotaRemaining,
    sessionId: session._id.toString(),
    isZeroCost: hintDecision.quotaCost === 0,
  });
}

export async function PATCH(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = payload;

  let body: { sessionId: string; userCode: string; language: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, userCode, language } = body;
  if (!sessionId || !userCode?.trim() || !language) {
    return NextResponse.json(
      { error: "sessionId, userCode, and language are required" },
      { status: 400 },
    );
  }

  await connectDB();

  const session = await Session.findOne({
    _id: sessionId,
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const problem = await Problem.findOne({ slug: session.problemSlug })
    .select("-pattern")
    .lean();

  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const hiddenTests = problem.testCases.filter((tc) => tc.isHidden);
  let hiddenTestFailed = false;

  if (hiddenTests.length > 0) {
    try {
      // Uses judge.ts — timeout protection, typed errors, concurrency limit
      // No inline fetch, no process.env.JUDGE0_URL, no RapidAPI
      const runResult = await runTestCases(userCode, language, hiddenTests);
      hiddenTestFailed = !runResult.allPassed;
    } catch (err) {
      if (err instanceof ExecutionError) {
        console.error("[hint/PATCH] Judge0 ExecutionError:", {
          type: err.type,
          message: err.message,
          userId,
          sessionId,
        });
      } else {
        console.error("[hint/PATCH] Unexpected execution error:", err);
      }
      // On execution failure, give benefit of the doubt
      // Don't block the solve — log and continue
      hiddenTestFailed = false;
    }
  }

  await Session.findOneAndUpdate(
    { _id: sessionId, userId: new mongoose.Types.ObjectId(userId) },
    {
      $set: {
        hiddenTestFailed,
        solved: !hiddenTestFailed,
        status: hiddenTestFailed ? "active" : "solved",
        lastActivityAt: new Date(),
      },
    },
  );

  return NextResponse.json({
    hiddenTestFailed,
    solved: !hiddenTestFailed,
    message: hiddenTestFailed
      ? "Your code passes the visible tests but failed a hidden test case. There's an edge case to find."
      : "All tests pass. You solved it.",
  });
}
