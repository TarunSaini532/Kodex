import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Session from "@/models/Session";
import Problem from "@/models/Problem";
import { getTokenFromRequest } from "@/lib/auth";
import { runTestCases, ExecutionError } from "@/lib/judge";
import { validateExecuteRequest } from "@/lib/validation";

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────
  const payload = getTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = payload;

  // ── Parse body ───────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateExecuteRequest(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { problemSlug, userCode, language, sessionId } = validation.data;

  await connectDB();

  const problem = await Problem.findOne({ slug: problemSlug })
    .select("-pattern")
    .lean();

  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const visibleTests = problem.testCases.filter((tc) => !tc.isHidden);
  if (visibleTests.length === 0) {
    return NextResponse.json(
      { error: "No visible test cases for this problem" },
      { status: 400 },
    );
  }

  let runResult;
  try {
    runResult = await runTestCases(userCode, language, visibleTests);
  } catch (err: unknown) {
    if (err instanceof ExecutionError) {
      console.error("[execute] ExecutionError:", {
        type: err.type,
        message: err.message,
        userId,
        problemSlug,
        language,
      });

      const userMessage =
        err.type === "timeout"
          ? "Code execution timed out. Your solution may have an infinite loop."
          : err.type === "unsupported_language"
            ? `Language "${language}" is not supported.`
            : "Execution service is temporarily unavailable. Try again in a moment.";

      return NextResponse.json(
        { error: userMessage, errorType: err.type },
        { status: err.type === "unsupported_language" ? 400 : 503 },
      );
    }

    // Unexpected error — log fully
    console.error("[execute] Unexpected error:", err);
    return NextResponse.json(
      { error: "Code execution failed unexpectedly — please try again." },
      { status: 500 },
    );
  }

  const { results, allPassed, firstFailure, overallStatus } = runResult;

  // ── Save compiler result to Session ─────────────────────
  // CRITICAL: hintRouter reads lastExecutionResult to make routing
  // decisions. Without this save, every hint is blind to compiler output.
  // Only save if sessionId was provided — execute can run without a session
  // (e.g. quick test before starting a session)
  if (sessionId) {
    try {
      await Session.findOneAndUpdate(
        {
          _id: sessionId,
          userId: new mongoose.Types.ObjectId(userId),
        },
        {
          $set: {
            userCode,
            language,
            lastRunPassed: allPassed,
            testResults: results.map((r) => ({
              passed: r.passed,
              input: r.input,
              expectedOutput: r.expectedOutput,
              actualOutput: r.actualOutput,
              executionTime: r.executionTimeMs,
              statusDescription: r.statusDescription,
            })),
            lastActivityAt: new Date(),

            // This is the key save — hintRouter reads these fields
            "lastExecutionResult.status": overallStatus,
            "lastExecutionResult.stderr": firstFailure?.stderr ?? null,
            "lastExecutionResult.failedTestInput": firstFailure?.input ?? null,
            "lastExecutionResult.failedExpected":
              firstFailure?.expectedOutput ?? null,
            "lastExecutionResult.failedActual":
              firstFailure?.actualOutput ?? null,
          },
          // Increment TLE counter only on TLE status
          ...(overallStatus === "TLE" && { $inc: { tleCount: 1 } }),
        },
      );
    } catch (err) {
      // Session save failure is non-fatal for execute
      // Student still sees their test results
      // hintRouter will just not have compiler context on next hint
      console.error("[execute] Session update failed:", err);
    }
  }

  // ── Return results ───────────────────────────────────────
  // Do NOT expose hidden test results here
  // Hidden tests run only on PATCH /api/kodex/hint (I Solved It)
  return NextResponse.json({
    testResults: results.map((r) => ({
      passed: r.passed,
      input: r.input,
      expectedOutput: r.expectedOutput,
      actualOutput: r.actualOutput,
      executionTimeMs: r.executionTimeMs,
      statusDescription: r.statusDescription,
    })),
    allPassed,
    executionStatus: overallStatus,
  });
}
