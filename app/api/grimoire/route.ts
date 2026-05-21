import { getTokenFromRequest } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Session from "@/models/Session";
import StudentProfile from "@/models/StudentProfile";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // ─────────────────────────────────────────────
    // STEP 1: Auth
    // ─────────────────────────────────────────────
    const token = getTokenFromRequest(req);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Please log in",
        },
        { status: 401 },
      );
    }

    await connectDB();

    // ─────────────────────────────────────────────
    // STEP 2: Fetch solved sessions with pattern cards
    // Lowest hintsGiven first (best solve quality)
    // ─────────────────────────────────────────────
    const sessions = await Session.find({
      userId: token.userId,
      solved: true,
      patternCard: { $ne: null },
    })
      .sort({ hintsGiven: 1 })
      .select("patternCard hintsGiven")
      .lean();

    // ─────────────────────────────────────────────
    // STEP 3: Fetch student profile intelligence
    // ─────────────────────────────────────────────
    const profile = await StudentProfile.findOne({
      userId: token.userId,
    }).select(
      "patternData strongPatterns recurringMistakes belt totalSolved totalAttempted",
    );
    // ─────────────────────────────────────────────
    // STEP 4: Deduplicate pattern cards
    // Keep lowest-hint solve version
    // ─────────────────────────────────────────────
    const seenPatterns = new Set<string>();

    const uniqueSessions = sessions.filter((session) => {
      const patternName = session.patternCard?.patternName;

      if (!patternName) {
        return false;
      }

      if (seenPatterns.has(patternName)) {
        return false;
      }

      seenPatterns.add(patternName);
      return true;
    });

    // ─────────────────────────────────────────────
    // STEP 5: Enrich pattern cards with profile data
    // ─────────────────────────────────────────────
    const grimoire = uniqueSessions.map((session) => {
      const card = session.patternCard;

      const masteryStats = profile?.patternData?.get(card.patternName) ?? null;
      return {
        patternName: card.patternName,
        intuition: card.intuition,
        template: card.template,
        mistakes: card.mistakes,
        whenToUse: card.whenToUse,

        mastery: masteryStats
          ? {
              attempted: masteryStats.attempted,
              solved: masteryStats.solved,
              avgHintsNeeded: masteryStats.avgHintsNeeded,
              lastMisconception: masteryStats.lastMisconception,
              lastAttemptedAt: masteryStats.lastAttemptedAt,
            }
          : null,

        isStrongPattern:
          profile?.strongPatterns?.includes(card.patternName) ?? false,
      };
    });

    // ─────────────────────────────────────────────
    // STEP 6: Response
    // Frontend-ready adaptive learning view
    // ─────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,

        profileSummary: {
          belt: profile?.belt ?? "white",
          totalSolved: profile?.totalSolved ?? 0,
          totalAttempted: profile?.totalAttempted ?? 0,
          recurringMistakes: profile?.recurringMistakes ?? [],
        },

        grimoire,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[grimoire] GET failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
