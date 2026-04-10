import { getTokenFromRequest } from "@/lib/auth";
import { executeCode } from "@/lib/judge";
import connectDB from "@/lib/mongodb";
import Problem from "@/models/Problem";
import Session from "@/models/Session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Please log in to continue",
        },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { code, language, testInput, sessionId, problemSlug } = body;

    if (!code || !language || !sessionId || !problemSlug) {
      return NextResponse.json(
        {
          success: false,
          message: "code, language, sessionId and problemSlug are required",
        },
        { status: 400 },
      );
    }

    await connectDB();
    const problem = await Problem.findOne({ slug: problemSlug });
    if (!problem) {
      return NextResponse.json(
        { success: false, message: "Problem not found" },
        { status: 404 },
      );
    }
    const visibleTests = problem.testCases.filter((tc: any) => !tc.isHidden);

    const testResults = await Promise.all(
      visibleTests.map(async (tc: any) => {
        const res = await executeCode(
          {
            code,
            language,
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
        };
      }),
    );

    const allPassed = testResults.every((r) => r.passed);

    const session = await Session.findByIdAndUpdate(
      { _id: sessionId, userId: token.userId },
      {
        $set: {
          lastRunPassed: allPassed,
          testResults,
        },
      },
      { new: true },
    );

    if (!session) {
      return NextResponse.json(
        {
          succes: false,
          message: "Session not found",
        }, 
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      allPassed,
      testResults,
      canMarkSolved: allPassed,
    });
  } catch (error) {
    console.error("[Execute] Route error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
