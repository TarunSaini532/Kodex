import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Session from "@/models/Session";
import { getTokenFromRequest } from "@/lib/auth";
import { isKillSwitchActive } from "@/lib/KillSwitch";
import { HINT_CONFIG as C } from "@/lib/hintConfig";
import mongoose from "mongoose";

const NUDGE_MESSAGES = [
  "You've been quiet for a while — is something specific feeling stuck, or are you working through the logic mentally?",
  "Still with it? Sometimes saying what you're thinking out loud helps — what's the last thing you tried?",
  "No pressure — but if you're hitting a wall, what part of the problem feels most uncertain right now?",
  "You've been on this a while. What does your current approach do correctly, even if it doesn't fully work yet?",
];

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = payload;

  if (await isKillSwitchActive("nudge")) {
    return NextResponse.json({ nudge: null, skipped: true });
  }

  let body: { sessionId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  await connectDB();

  const session = await Session.findOne({
    _id: sessionId,
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.solved) {
    return NextResponse.json({ nudge: null, skipped: true });
  }

  if (session.inactivityNudgeCount >= C.maxNudgesPerSession) {
    return NextResponse.json({ nudge: null, skipped: true });
  }

  const nudgeMessage =
    NUDGE_MESSAGES[session.inactivityNudgeCount % NUDGE_MESSAGES.length];

  await Session.findOneAndUpdate(
    { _id: sessionId, userId: new mongoose.Types.ObjectId(userId) },
    {
      $inc: { inactivityNudgeCount: 1, nudgesReceived: 1 },
      $set: { lastActivityAt: new Date() },
    },
  );

  return NextResponse.json({
    nudge: nudgeMessage,
    nudgeCount: session.inactivityNudgeCount + 1,
  });
}
