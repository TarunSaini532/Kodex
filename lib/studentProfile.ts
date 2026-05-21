import Groq from "groq-sdk";
import { env } from "./env";
import StudentProfile, {
  IStudentProfile,
  PatternStat,
} from "@/models/StudentProfile";
import { BeltLevel, DSAPattern } from "@/types/kodex";
import Session, { ISession } from "@/models/Session";
import User from "@/models/User";
import mongoose from "mongoose";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });
interface SummarizationResult {
  keyMisconception: string | null;
  recurringMistake: string | null;
  patternInsight: string | null;
}

// --------------------------------
// Belt Calculation
//
// Thresholds are intentionally hard to game — avgHintsNeeded
// is a rolling average, not a single session number.
//
// White:  < 10 solved (default)
// Yellow: 10+ solved
// Green:  30+ solved, avgHintsNeeded <= 3
// Brown:  60+ solved, avgHintsNeeded <= 2, 3+ mastered patterns
// Black:  100+ solved, avgHintsNeeded <= 1.5, 5+ mastered patterns
//
// A "mastered pattern" = solved >= 3 AND avgHintsNeeded <= 2
// ────────────────────────────────────────────

export function calculateBelt(profile: IStudentProfile): BeltLevel {
  const { totalSolved, totalHintsUsed, patternData } = profile;
  const avgHints = totalSolved > 0 ? totalHintsUsed / totalSolved : Infinity;

  let masteredPatterns = 0;
  if (patternData) {
    for (const [, stat] of patternData) {
      //for(const [, stat] of patternData)
      if (stat.solved >= 3 && stat.avgHintsNeeded <= 2) {
        // comma (,) means skip first element ,i.e, ignore keys and stroe values in stats
        masteredPatterns++;
      }
    }
  }
  if (totalSolved >= 100 && avgHints <= 1.5 && masteredPatterns >= 5) {
    return "black";
  }
  if (totalSolved >= 60 && avgHints <= 2 && masteredPatterns >= 3) {
    return "brown";
  }
  if (totalSolved >= 30 && avgHints <= 3) {
    return "green";
  }
  if (totalSolved >= 10) {
    return "yellow";
  }
  return "white";
}

function scheduleRevisits(
  problemSlug: string,
  siblingSlug: string | null,
): IStudentProfile["revisitQueue"] {
  const now = Date.now();
  const day = 86_400_000; // ms
  return [
    {
      problemSlug,
      siblingSlug: null,
      dueAt: new Date(now + 3 * day),
      revisitNumber: 1,
    },
    {
      problemSlug: siblingSlug ?? problemSlug,
      siblingSlug,
      dueAt: new Date(now + 7 * day),
      revisitNumber: 2,
    },
    {
      problemSlug: siblingSlug ?? problemSlug,
      siblingSlug,
      dueAt: new Date(now + 21 * day),
      revisitNumber: 3,
    },
  ];
}

async function summarizeSession(
  hintLog: ISession["hintLog"],
  pattern: DSAPattern,
): Promise<SummarizationResult> {
  if (!hintLog || hintLog.length === 0) {
    return {
      keyMisconception: null,
      recurringMistake: null,
      patternInsight: null,
    };
  }
  const logSummary = hintLog
    .map(
      (entry, i) =>
        `Hint ${i + 1} [${entry.hintType}]: misconception=${entry.misconception ?? "none"}`,
    )
    .join("\n");

  const prompt = `You are analyzing a student's DSA problem-solving session.
Pattern: ${pattern}
 
Hint log:
${logSummary}
 
Respond ONLY with a JSON object. No preamble. No markdown.
{
  "keyMisconception": "the most important conceptual error the student made, or null if none",
  "recurringMistake": "a mistake that appeared more than once, or null if none",
  "patternInsight": "one sentence on how the student demonstrated understanding of the pattern, or null"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 300,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in response");

    const parsed = JSON.parse(raw.slice(start, end + 1));
    return {
      keyMisconception: parsed.keyMisconception ?? null,
      recurringMistake: parsed.recurringMistake ?? null,
      patternInsight: parsed.patternInsight ?? null,
    };
  } catch (err) {
    console.error("[studentProfile] Summarization failed:", err);
    return {
      keyMisconception: null,
      recurringMistake: null,
      patternInsight: null,
    };
  }
}

export async function updateStudentProfile(
  userId: string,
  sessionId: string,
): Promise<void> {
  try {
    // 1. Fetch session — need hintLog, pattern, hintsGiven, problemSlug
    const session = await Session.findOne({
      _id: sessionId,
      userId,
    }).lean();
    if (!session) {
      console.error(`[studentProfile] Session not found: ${sessionId}`);
      return;
    }

    const { pattern, hintsGiven, problemSlug, hintLog, assistedSolve } =
      session;
    // 2. Fetch or create StudentProfile
    let profile = await StudentProfile.findOne({ userId });
    if (!profile) {
      profile = await StudentProfile.create({
        userId: new mongoose.Types.ObjectId(userId),
      });
    }

    // 3. AI summarization (background — failure is non-fatal)
    const summary = await summarizeSession(hintLog ?? [], pattern);

    // 4. Update aggregate stats
    profile.totalAttempted = (profile.totalAttempted ?? 0) + 1;
    profile.totalSolved = (profile.totalSolved ?? 0) + 1;
    profile.totalHintsUsed = (profile.totalHintsUsed ?? 0) + (hintsGiven ?? 0);

    // 5. Update per-pattern stats
    const existing: PatternStat = profile.patternData.get(pattern) ?? {
      attempted: 0,
      solved: 0,
      avgHintsNeeded: 0,
      lastMisconception: null,
      lastAttemptedAt: new Date(),
    };

    const newSolved = existing.solved + 1;
    const newAvg =
      (existing.avgHintsNeeded * existing.solved + (hintsGiven ?? 0)) /
      newSolved;

    profile.patternData.set(pattern, {
      attempted: existing.attempted + 1,
      solved: newSolved,
      avgHintsNeeded: Math.round(newAvg * 10) / 10, // 1 decimal place
      lastMisconception: summary.keyMisconception,
      lastAttemptedAt: new Date(),
    });
    // 6. Update recurringMistakes — rolling window, capped at 10
    if (summary.recurringMistake) {
      profile.recurringMistakes = [
        summary.recurringMistake,
        ...profile.recurringMistakes,
      ].slice(0, 10);
    }

    // 7. Recalculate strongPatterns
    const strong: DSAPattern[] = [];
    for (const [pat, stat] of profile.patternData) {
      if (stat.solved >= 3 && stat.avgHintsNeeded <= 2) {
        strong.push(pat as DSAPattern);
      }
    }
    profile.strongPatterns = strong;

    // 8. Recalculate belt
    const newBelt = calculateBelt(profile);
    const beltChanged = newBelt !== profile.belt;
    profile.belt = newBelt;
    profile.beltUpdatedAt = beltChanged ? new Date() : profile.beltUpdatedAt;

    // 9. Schedule spaced repetition
    // Fetch a sibling slug from the Problem model
    const { default: Problem } = await import("@/models/Problem");
    const problem = await Problem.findOne({ slug: problemSlug })
      .select("siblingProblems")
      .lean();

    const siblingSlug = problem?.siblingProblems?.length
      ? problem.siblingProblems[
          Math.floor(Math.random() * problem.siblingProblems.length)
        ]
      : null;

    const newRevisits = scheduleRevisits(problemSlug, siblingSlug);
    // Remove any existing revisits for this problem (avoid duplicates on re-solve)
    profile.revisitQueue = [
      ...profile.revisitQueue.filter((r) => r.problemSlug !== problemSlug),
      ...newRevisits,
    ];
    profile.lastUpdated = new Date();
    await profile.save();

    // 10. Denormalize belt to User model (fast-read cache)
    if (beltChanged) {
      await User.findByIdAndUpdate(userId, { belt: newBelt });
      console.log(`[studentProfile] Belt upgraded: ${userId} → ${newBelt}`);
    }

    console.log(
      `[studentProfile] Updated for user=${userId} problem=${problemSlug} ` +
        `belt=${newBelt} assisted=${assistedSolve}`,
    );
  } catch (err) {
    console.error("[studentProfile] Update failed (non-fatal):", err);
  }
}

export function buildProfileContext(
  profile: IStudentProfile | null,
  user: { knownConcepts: string[]; experienceLevel: string },
): string {
  if (!profile) {
    // Cold start — no profile yet
    return [
      `Experience level: ${user.experienceLevel}`,
      `Known concepts: ${user.knownConcepts.join(", ") || "none specified"}`,
      "No solve history yet.",
    ].join("\n");
  }

  const lines: string[] = [
    `Belt: ${profile.belt}`,
    `Total solved: ${profile.totalSolved}`,
    `Avg hints per problem: ${
      profile.totalSolved > 0
        ? (profile.totalHintsUsed / profile.totalSolved).toFixed(1)
        : "N/A"
    }`,
  ];

  if (profile.strongPatterns.length > 0) {
    lines.push(`Strong patterns: ${profile.strongPatterns.join(", ")}`);
  }

  if (profile.recurringMistakes.length > 0) {
    lines.push(
      `Recurring mistakes (recent): ${profile.recurringMistakes.slice(0, 3).join(" | ")}`,
    );
  }

  // Pattern-specific context for the current session's pattern
  return lines.join("\n");
}
