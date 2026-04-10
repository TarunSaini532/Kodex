import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getConceptFromLibrarian } from "@/lib/librarian";
import { getQuota, incrementQuota } from "@/lib/redis";
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

    const quota = await getQuota(token.userId, "concept");
    if (!quota.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: "You have used all 5 hints for today. Come back tomorrow!",
          hintsRemaining: 0,
          hintsUsedToday: quota.hintsUsedToday,
          exhausted: true,
        },
        { status: 429 },
      ); //429: too many request
    }
    const body = await req.json();
    const { question, userCode, problemSlug, language } = body;

    if (!question || !userCode || !language) {
      return NextResponse.json(
        {
          success: false,
          message: "question, code and language are required",
        },
        { status: 400 },
        // 400 = Bad Request — client sent incomplete data
      );
    }
    const LibrarianResponse = await getConceptFromLibrarian({
      question,
      userCode,
      problemSlug,
      language,
    });

    const newHintsUsed = await incrementQuota(token.userId, "concept");
    const hintsRemaining = Math.max(0, 5 - newHintsUsed);

    return NextResponse.json({
      success: true,
      explanation: LibrarianResponse.explanation,
      hasDiagram: LibrarianResponse.hasDiagram,
      mermaidCode: LibrarianResponse.mermaidCode,
      quotaRemaining: hintsRemaining,
    });
  } catch (error) {
    console.error("Cocncept API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong. Please try again.",
      },
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

    const quota = await getQuota(tokenPayload.userId, "concept");

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
