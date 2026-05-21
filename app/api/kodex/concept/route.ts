import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { getQuota, incrementQuota } from "@/lib/redis";
import { getConceptFromLibrarian } from "@/lib/librarian";
import { validateConceptRequest } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quota = await getQuota(payload.userId, "concept");
  return NextResponse.json({
    quotaRemaining: quota.hintsRemaining,
    dailyLimit: quota.dailyLimit,
  });
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = payload;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateConceptRequest(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { question, userCode, problemSlug, language } = validation.data;

  // Concept quota: 5/day — separate from hint quota (50/day)
  const quota = await getQuota(userId, "concept");
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Daily concept quota exhausted",
        quotaRemaining: 0,
        message:
          "You've used your 5 concept explanations for today. " +
          "Use the Coach for hints — it will guide you through the logic.",
      },
      { status: 429 },
    );
  }

  let result;
  try {
    result = await getConceptFromLibrarian({
      question,
      userCode,
      problemSlug,
      language,
    });
  } catch (err) {
    console.error("[concept] Librarian failed:", err);
    return NextResponse.json(
      { error: "Failed to get explanation — please try again" },
      { status: 503 },
    );
  }

  const used = await incrementQuota(userId, "concept");
  const newQuotaRemaining = Math.max(0, quota.dailyLimit - used);

  return NextResponse.json({
    explanation: result.explanation,
    hasDiagram: result.hasDiagram,
    mermaidCode: result.mermaidCode,
    quotaRemaining: newQuotaRemaining,
  });
}
