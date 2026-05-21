import { HintDecision } from "@/types/kodex";
import { isKillSwitchActive } from "./KillSwitch";
import { HINT_CONFIG as C } from "./hintConfig";
import { runStaticChecks } from "./staticAnalysis";

interface ExecutionResult {
  status: "TLE" | "Runtime Error" | "Wrong Answer" | "Accepted" | null;
  stderr?: string | null;
  failedTestInput?: string | null;
  failedExpected?: string | null;
  failedActual?: string | null;
}

interface SessionSnapshot {
  hintsGiven: number;
  approachValidated: boolean;
  constraintsCoachDone: boolean;
  comprehensionCoachDone: boolean;
  lastRunPassed: boolean;
  hiddenTestFailed: boolean;
  tleCount: number;
  consecutiveSignalCount?: Map<string, number>;
  isFrustated: boolean;
  logicTrapPending: boolean;
  beltAtSessionStart: string;
  language: string;
  currentCodeHash?: string;
  hintTimeStamps?: Date[];
}

interface Problem {
  contraints: string[];
  title: string;
}

interface RouterParams {
  session: SessionSnapshot;
  userCode: string;
  studentApproach: string;
  problem: Problem;
  elapsedMinutes: number;
  lastExecution: ExecutionResult|null;
}

function realCodeLength(code: string): number {
  return code.replace(/\s+/g, "").length;
}

function consecutiveCount(session: SessionSnapshot, signal: string): number {
  return session.consecutiveSignalCount?.get(signal) ?? 0;
}

// Gaming Detection

function isGaming(session: SessionSnapshot, currentCodeHash: string): boolean {
  const timestamps = session.hintTimeStamps ?? [];
  const required = C.gamingConsecutiveCount;

  if (timestamps.length < required + 1) return false;
  const thresholdMs = C.minSecondsBetweenHints * 1000;
  for (let i = 0; i < required; i++) {
    const t1 = timestamps[timestamps.length - 1 - i];
    const t2 = timestamps[timestamps.length - 2 - i];
    const gap = new Date(t1).getTime() - new Date(t2).getTime();
    if (gap >= thresholdMs) return false;
  }
  const codeUnchanged =
    session.currentCodeHash != null &&
    session.currentCodeHash === currentCodeHash;

  return codeUnchanged;
}

//Belt

type Belt = "yellow" | "white" | "green" | "brown" | "black";

function isExpertBelt(belt: string): belt is "brown" | "black" {
  return belt === "brown" || belt === "black";
}

function isIntermediateBelt(belt: string): belt is "green" {
  return belt === "green";
}

//   P0  Static analysis          — no AI, no quota
//   P1  Gaming / velocity abuse  — no quota increment
//   P2  Gatekeeper phase         — no code / approach validation
//   P3  Code exists, never run   — zero cost nudge
//   P4  Compiler results         — reactive to last execution
//   P5  Tests passing            — passing but wants more hints
//   P6  Deep session             — exhausted normal flow
//   P7  Default fallback         — Socratic

export async function determineHintType(
  params: RouterParams,
): Promise<HintDecision> {
  const {
    session,
    userCode,
    studentApproach,
    problem,
    elapsedMinutes,
    lastExecution,
  } = params;

  const codeLen = realCodeLength(userCode);
  const hasRealCode = codeLen > C.codeRealLengthMin;
  const waCount = consecutiveCount(session, "Wrong Answer");
  const tleCount = session.tleCount ?? 0;
  const { hashCode } = await import("./codeHash");
  const currentCodeHash = hashCode(userCode);

  // ── PRIORITY 0: Static Analysis ──────────────────────────
  if (!(await isKillSwitchActive("static_analysis"))) {
    const constraintText = problem.contraints.join(" ");
    const warnings = runStaticChecks(
      userCode,
      session.language,
      constraintText,
    );
    if (warnings.length > 0) {
      return {
        type: "static_warning",
        quotaCost: 0,
        message: warnings[0].message,
      };
    }
  }
  // ── PRIORITY 1: Gaming Detection ─────────────────────────

  if (!(await isKillSwitchActive("gaming_detection"))) {
    if (isGaming(session, currentCodeHash)) {
      return {
        type: "forced_dry_run",
        quotaCost: 0,
        message:
          "You're moving fast and your code hasn't changed since the last hint." +
          "Before continuing, walk me through what your current code does on the " +
          "first example. Step by step.",
      };
    }
  }

  // ── PRIORITY 2: Gatekeeper Phase ─────────────────────────
  const belt = session.beltAtSessionStart;

  if (!isExpertBelt(belt)) {
    if (!isIntermediateBelt(belt)) {
      // WHITE / Yellow Full gatekeeper
      if (!session.constraintsCoachDone) {
        return {
          type: "approach_validation",
          quotaCost: 1,
        };
      }
      if (!session.comprehensionCoachDone) {
        return { type: "approach_validation", quotaCost: 1 };
      }
    }
  }

  //Non -expert belts

  if (!session.approachValidated) {
    if (!studentApproach?.trim()) {
      if (!hasRealCode) {
        return {
          type: "blank_screen_early",
          quotaCost: 1,
        };
      }
      if (elapsedMinutes > C.analysisParalysisMintutes) {
        return {
          type: "analysis_paralysis",
          quotaCost: 1,
        };
      }
    }
    return { type: "approach_validation", quotaCost: 1 };
  }
  // ── PRIORITY 3: No Real Code ──────────────────────────────

  if (!hasRealCode) {
    if (elapsedMinutes > C.analysisParalysisMintutes) {
      return {
        type: "analysis_paralysis",
        quotaCost: 1,
      };
    }
    return {
      type: "blank_screen_early",
      quotaCost: 1,
    };
  }

  // ── PRIORITY 4: Code Exists, Never Run ───────────────────

  if (!lastExecution) {
    if (!(await isKillSwitchActive("run_first"))) {
      return {
        type: "run_first",
        quotaCost: 0,
        message:
          "Run your code first. Let's see what it actually does " +
          "before we theorise about it.",
      };
    }
  }

  // ── PRIORITY 5: Compiler Results ─────────────────────────

  if (lastExecution && !(await isKillSwitchActive("compiler_reactive"))) {
    if (lastExecution.status === "Runtime Error") {
      return {
        type: "guided_failure",
        quotaCost: 1,
      };
    }
    if (lastExecution.status === "Wrong Answer" && !session.lastRunPassed) {
      const hasPendingTLE = tleCount > 0;
      if (waCount >= C.wasEscalationCount) {
        return {
          type: "code_correction",
          quotaCost: 1,
          escalated: true,
        };
      }
      if (waCount >= C.wasBottleneckCount) {
        return {
          type: "bottleneck",
          quotaCost: 1,
          compilerText:
            `Student has had ${waCount} consecutive wrong answers. ` +
            `Dry run approach not resolving the issue.`,
        };
      }
      return { type: "dry_run", quotaCost: 1, hasPendingTLE };
    }
    if (session.lastRunPassed && session.hiddenTestFailed) {
      return {
        type: "local_success_global_failure",
        quotaCost: 1,
      };
    }
    if (lastExecution.status === "TLE") {
      if (!(await isKillSwitchActive("pattern_pivot"))) {
        const isOverEngineered =
          tleCount >= C.tlePivotCount &&
          (userCode.split("\n").length > C.tleLargeCodeLineCount ||
            /segment.*tree|segtree|fenwick|sparse.*table/i.test(userCode));
        if (isOverEngineered) {
          return {
            type: "pattern_pivot",
            quotaCost: 1,
          };
        }
      }
      return {
        type: "complexity_check",
        quotaCost: 1,
      };
    }
  }
  // ── PRIORITY 6: Tests Passing ────────────────────────────

  if (session.lastRunPassed && !session.hiddenTestFailed) {
    return { type: "passing_wants_hint", quotaCost: 1 };
  }
  // ── PRIORITY 7: Deep Session ─────────────────────────────

  if (session.hintsGiven >= C.codeFixerHintCount && hasRealCode) {
    return { type: "code_correction", quotaCost: 1 };
  }
  // ── PRIORITY 8: Socratic Default ─────────────────────────────

  return { type: "socratic_default", quotaCost: 1 };
}
