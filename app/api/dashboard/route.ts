import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Session from "@/models/Session";
import StudentProfile from "@/models/StudentProfile";
import { getTokenFromRequest } from "@/lib/auth";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = payload;

  await connectDB();

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [user, profile, sessionStats, recentSessions] = await Promise.all([
    User.findById(userId).select("-password").lean(),

    StudentProfile.findOne({ userId: userObjectId }).lean(),

    Session.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalAttempted: { $sum: 1 },
          totalSolved: { $sum: { $cond: ["$solved", 1, 0] } },
          totalHintsUsed: { $sum: "$hintsGiven" },
          avgHintsPerProblem: { $avg: "$hintsGiven" },
        },
      },
    ]),

    Session.find({ userId: userObjectId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select("problemSlug solved status hintsGiven updatedAt patternCard")
      .lean(),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const stats = sessionStats[0] ?? {
    totalAttempted: 0,
    totalSolved: 0,
    totalHintsUsed: 0,
    avgHintsPerProblem: 0,
  };

  const patternBreakdown: Record<
    string,
    {
      attempted: number;
      solved: number;
      avgHints: number;
    }
  > = {};

  if (profile?.patternData) {
    for (const [pattern, data] of profile.patternData) {
      patternBreakdown[pattern] = {
        attempted: data.attempted,
        solved: data.solved,
        avgHints: data.avgHintsNeeded,
      };
    }
  }

  const today = new Date();
  const dueTodayRevisits =
    profile?.revisitQueue?.filter((r) => new Date(r.dueAt) <= today) ?? [];

  // Bug fixed: was "succes: true"
  return NextResponse.json({
    success: true,
    dashboard: {
      user: {
        name: user.name,
        email: user.email,
        belt: user.belt,
        experienceLevel: user.experienceLevel,
      },
      stats: {
        totalAttempted: stats.totalAttempted,
        totalSolved: stats.totalSolved,
        totalHintsUsed: stats.totalHintsUsed,
        avgHintsPerProblem:
          Math.round((stats.avgHintsPerProblem ?? 0) * 10) / 10,
        solveRate:
          stats.totalAttempted > 0
            ? Math.round((stats.totalSolved / stats.totalAttempted) * 100)
            : 0,
      },
      patternBreakdown,
      strongPatterns: profile?.strongPatterns ?? [],
      recurringMistakes: profile?.recurringMistakes?.slice(0, 3) ?? [],
      recentSessions: recentSessions.map((s) => ({
        problemSlug: s.problemSlug,
        solved: s.solved,
        status: s.status,
        hintsGiven: s.hintsGiven,
        patternCard: s.patternCard,
        lastActivity: s.updatedAt,
      })),
      revisitsDueToday: dueTodayRevisits.map((r) => ({
        problemSlug: r.problemSlug,
        siblingSlug: r.siblingSlug,
        revisitNumber: r.revisitNumber,
        dueAt: r.dueAt,
      })),
    },
  });
}
