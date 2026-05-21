import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Session from "@/models/Session";
import { getTokenFromRequest } from "@/lib/auth";
import { isKillSwitchActive } from "@/lib/KillSwitch";
import { validateFeedbackRequest } from "@/lib/validation";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = payload;

  if (await isKillSwitchActive("telemetry")) {
    return NextResponse.json({ saved: false, skipped: true });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateFeedbackRequest(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { sessionId, hintNumber, helpful } = validation.data;

  await connectDB();

  // hintNumber is 1-indexed — array is 0-indexed
  const arrayIndex = hintNumber - 1;

  const result = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      userId: new mongoose.Types.ObjectId(userId),
      [`hintLog.${arrayIndex}`]: { $exists: true },
    },
    {
      $set: {
        [`hintLog.${arrayIndex}.userFeedback`]: helpful,
        [`hintLog.${arrayIndex}.feedbackAt`]: new Date(),
      },
    },
    { new: true },
  );

  if (!result) {
    return NextResponse.json(
      { error: "Session or hint entry not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ saved: true });
}
