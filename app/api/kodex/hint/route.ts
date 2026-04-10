import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Session from "@/models/Session";
import User from "@/models/User";
import { getTokenFromRequest } from "@/lib/auth";
import { getHintFromClaude, Message } from "@/lib/claude";
import { getQuota, incrementQuota } from "@/lib/redis";
import Problem from "@/models/Problem";
import { executeCode } from "@/lib/judge";

export async function POST(request: NextRequest) {
  try {
    // verify jwt
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Please log in to continue",
        },
        { status: 401 },
      );
    }

    // check if the quota is exhausted or not
    const quota = await getQuota(token.userId, "hint");
    if (!quota.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: "You have used all 50 hints for today. Come back tomorrow!",
          hintsRemaining: 0,
          hintsUsedToday: quota.hintsUsedToday,
          exhausted: true,
        },
        { status: 429 },
      ); //429: too many request
    }

    // parse and validate request body
    const body = await request.json();
    const {
      problem,
      userCode,
      language,
      hintsGiven,
      conversationHistory,
      sessionId,
      studentApproach,
      nudgeTriggered,
      solved,
    } = body;
    if (!problem || !userCode || !language) {
      return NextResponse.json(
        {
          success: false,
          message: "Problem, code and language are required",
        },
        { status: 400 },
        // 400 = Bad Request — client sent incomplete data
      );
    }

    // fetch user profile for personalization
    await connectDB();
    const currUser = await User.findById(token.userId).select(
      "knownConcepts experienceLevel",
    );
    // Call groq api
    const ClaudeResponse = await getHintFromClaude({
      problem,
      userCode,
      language,
      hintsGiven: hintsGiven || 0,
      conversationHistory: conversationHistory || [],
      knownConcepts: currUser?.knownConcepts || [],
      experienceLevel: currUser?.experienceLevel || "beginner",
      studentApproach: studentApproach || "",
      nudgeTriggered: nudgeTriggered || false,
      solved: solved || false,
    });

    // increment quota in redis
    const newHintsUsed = await incrementQuota(token.userId, "hint");
    const hintsRemaining = Math.max(0, 50 - newHintsUsed);

    let session;
    if (!sessionId) {
      session = await Session.create({
        userId: token.userId,
        problemSlug: problem,
        userCode,
        language,
        pattern: ClaudeResponse.pattern,
        hintsGiven: ClaudeResponse.hintsGiven,
        currentMode: ClaudeResponse.mode,
        solved: false,
        status: "active",
      });
    } else {
      session = await Session.findByIdAndUpdate(
        { _id: sessionId, userId: token.userId },
        {
          $set: {
            userCode,
            hintsGiven: ClaudeResponse.hintsGiven,
            currentMode: ClaudeResponse.mode,
            ...(ClaudeResponse.structuredReveal && {
              structureReveal: ClaudeResponse.structuredReveal,
            }),
            // Save pattern card when solved
            ...(ClaudeResponse.patternCard && {
              patternCard: ClaudeResponse.patternCard,
            }),
            // Save tradeoff question when solved
            ...(ClaudeResponse.tradeoffQuestion && {
              tradeoffQuestion: ClaudeResponse.tradeoffQuestion,
            }),
          },
        },
        { new: true },
      );
    }

    // ── SECURITY: IDOR Prevention ────────────────────────────
    // IDOR = Insecure Direct Object Reference
    // Attacker could guess sessionId and modify another user's session
    // We verify the session's userId matches the authenticated user
    // If mismatch → 404 (don't confirm session exists — info leak)
    if (!session || session.userId.toString() !== token.userId) {
      return NextResponse.json(
        {
          succes: false,
          message: "Session not found",
        },
        { status: 404 },
      );
    }

    //Build updated conversation history
    const updateHistory: Message[] = [
      ...(conversationHistory || []),
      {
        role: "user",
        content: `Problem: ${problem}\n\nMy code:\n${userCode}`,
      },
      {
        role: "assistant",
        content: JSON.stringify(ClaudeResponse),
      },
    ];

    // return response
    return NextResponse.json(
      {
        success: true,
        sessionId: session._id,
        hint: ClaudeResponse.hint,
        pattern: ClaudeResponse.pattern,
        mode: ClaudeResponse.mode,
        hintsGiven: ClaudeResponse.hintsGiven,
        readyToReveal: ClaudeResponse.readyToReveal,
        encouragement: ClaudeResponse.encouragement,
        patternCard: ClaudeResponse.patternCard,
        structuredReveal: ClaudeResponse.structuredReveal,
        tradeoffQuestion: ClaudeResponse.tradeoffQuestion,
        conversationHistory: updateHistory,
        hintsRemaining,
        hintsUsedToday: newHintsUsed,
        dailyLimit: 50,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Hint API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong. Please try again.",
      },
      { status: 500 },
    );
  }
}

function getHiddenTestHint(status: string): string {
  if (status === "Time Limit Exceeded")
    return "You passed the visible tests but your solution is too slow for large inputs. What is your current time complexity?";
  if (status === "Runtime Error")
    return "You passed visible tests but crashes on edge cases. What happens when the input is empty or contains duplicates?";
  return "You passed visible tests but fails on edge cases. What assumptions are you making about the input?";
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Please log in to continue" },
        { status: 401 },
      );
    }
    const body = await request.json();
    const { sessionId, problemSlug } = body;
    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: "Session ID is required" },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await Session.findById({
      _id: sessionId,
      userId: token.userId,
    }).select("userCode language");

    const problem = await Problem.findOne({ slug: problemSlug });

    const hiddenTest = problem.testCases.filter((tc: any) => tc.isHidden);
    const testResults = await Promise.all(
      hiddenTest.map(async (tc: any) => {
        const res = await executeCode(
          {
            code: user.userCode,
            language: user.language,
            testInput: tc.input,
          },
          tc.expectedOutput,
        );
        return {
          passed: res.passed,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: res.actualOutput,
          executionTime: res.executionTime,
          statusDescription: res.statusDescription,
        };
      }),
    );
    const allPassed = testResults.every((r) => r.passed);

    if (allPassed) {
      const session = await Session.findByIdAndUpdate(
        { _id: sessionId, userId: token.userId },
        {
          $set: {
            solved: true,
            status: "solved",
          },
        },
        { new: true },
      );

      if (!session) {
        return NextResponse.json(
          { success: false, message: "Session not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        {
          success: true,
          message: "Marked as solved — great work!",
        },
        { status: 200 },
      );
    } else {
      const failedTest = testResults.find((r) => !r.passed);
      const hint = getHiddenTestHint(
        failedTest?.statusDescription ?? "Wrong Answer",
      );
      return NextResponse.json(
        {
          success: false,
          hiddenTestFailed: true,
          hint,
          message: "You passed visible tests but failed on hidden cases.",
        },
        { status: 200 },
      );
    }
  } catch (err) {
    console.error("Mark solved error:", err);
    return NextResponse.json(
      { success: false, message: "Something went wrong." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const tokenPayload = getTokenFromRequest(request);

    if (!tokenPayload) {
      return NextResponse.json(
        { success: false, message: "Please log in" },
        { status: 401 },
      );
    }

    const quota = await getQuota(tokenPayload.userId, "hint");

    return NextResponse.json(
      {
        success: true,
        hintsRemaining: quota.hintsRemaining,
        hintsUsedToday: quota.hintsUsedToday,
        dailyLimit: quota.dailyLimit,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Quota status error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
