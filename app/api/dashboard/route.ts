import { getTokenFromRequest } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Session from "@/models/Session";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

function masteryScore(avgHints: number): number {
  if (avgHints === 0) return 100;
  if (avgHints <= 1) return 80;
  if (avgHints <= 2) return 60;
  if (avgHints <= 3) return 40;
  return 20;
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Please log in" },
        { status: 401 },
      );
    }

    await connectDB();

    //basic stats
    const basicStats = await Session.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(token.userId),
        },
      },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 }, // count every session
          totalSolved: { $sum: { $cond: ["$solved", 1, 0] } }, // count solved: true cond [if, then , else]
          totalHints: { $sum: "$hintsGiven" },
        },
      },
    ]);

    const stats = basicStats[0] ?? {
      totalAttempted: 0,
      totalSolved: 0,
      totalHints: 0,
    };

    const avgHintsPerProblem =
      stats.totalAttempted > 0
        ? (stats.totalHints / stats.totalAttempted).toFixed(2)
        : 0;

    // radar chart
    const patternStats = await Session.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(token.userId),
        },
      },
      {
        $group: {
          _id: "$pattern",
          attempted: { $sum: 1 },
          solved: { $sum: { $cond: ["$solved", 1, 0] } },
          totalHints: { $sum: "$hintsGiven" },
          avgHints: { $avg: "$hintsGiven" },
        },
      },
      //shape the object
      {
        $project: {
          pattern: "$_id",
          attempted: 1,
          solved: 1,
          avgHints: { $round: ["$avgHints", 2] },
        },
      },
      {
        $sort: { pattern: 1 },
      },
    ]);

    const perPatternMastery = patternStats.map((p: any) => ({
      pattern: p.pattern,
      attempted: p.attempted,
      solved: p.solved,
      avgHints: p.avgHints,
      mastery: masteryScore(p.avgHints),
    }));

    const revisitSession = await Session.find({
      userId: token.userId,
      status: "revisit",
    })
      .select("problemSlug hintsGiven updatedAt")
      .sort({ updatedAt: -1 })
      .limit(10);

    return NextResponse.json(
      {
        succes: true,
        stats: {
          totalAttempted: stats.totalAttempted,
          totalSolved: stats.totalSolved,
          totalHints: stats.totalHints,
          avgHintsPerProblem,
          solveRate:
            stats.totalAttempted > 0
              ? +((stats.totalSolved / stats.totalAttempted) * 100).toFixed(1)
              : 0,
        },
        perPatternMastery,
        revisit: revisitSession,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Dashboard] error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
