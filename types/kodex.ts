export type BeltLevel = "white" | "yellow" | "green" | "brown" | "black";

export type DSAPattern =
  | "sliding window"
  | "two pointers"
  | "fast and slow pointers"
  | "dynamic programming"
  | "binary search"
  | "depth first search"
  | "breadth first search"
  | "backtracking"
  | "greedy"
  | "heap"
  | "other";

export type HintMode =
  | "constraint_coach"
  | "comprehension_check"
  | "approach_validation"
  | "socratic"
  | "structured_reveal"
  | "code_correction"
  | "check_in"
  | "forced_dry_run"
  | "paste_check"
  | "logic_trap"
  | "reflection_gate"
  | "syntax_bridge"
  | "assisted_reveal"
  | "static_warning"
  | "run_first"
  | "analysis_paralysis"
  | "local_success_global_failure"
  | "pattern_pivot"
  | "guided_failure"
  | "dry_run"
  | "complexity_check"
  | "bottleneck"
  | "pattern_reveal"
  | "implementation_help";

export type HintType =
  | "static_warning" // P0 — integer overflow, bounds etc.
  | "run_first" // P4 — code exists but not run
  | "analysis_paralysis" // P2/P3 — no code after 10+ min
  | "blank_screen_early" // P2/P3 — no code, < 10 min
  | "approach_validation" // P2 — gatekeeper flow
  | "guided_failure" // P5 — Runtime Error
  | "dry_run" // P5 — Wrong Answer (first/second)
  | "local_success_global_failure" // P5 — passed visible, failed hidden
  | "complexity_check" // P5 — TLE
  | "pattern_pivot" // P5 — TLE + over-engineered
  | "bottleneck" // P5 — 2 consecutive WA
  | "passing_wants_hint" // P6 — all tests passing
  | "code_correction" // P6/P7 — 3+ WA or 5+ hints
  | "socratic_default" // P8 — catch-all
  | "syntax_bridge" // Prompt B branch — syntax confusion
  | "logic_trap" // Paste/gaming detection
  | "forced_dry_run"; // Gaming detection penalty

// ? = property may or may not exist
export interface HintDecision {
  type: HintType;
  quotaCost: 1 | 0;
  hasPendingTLE?: boolean;
  escalated?: boolean;
  compilerText?: String;
  message?: String;
}

export interface PatternCard {
  patternName: string;
  signals: [string, string, string];
  oneLineSummary: string;
}

export interface StructuredReveal {
  patternName: string;
  keyInsight: string;
  approach: string[];
  yourTurn: string;
  commonMistake: string;
}

export interface HintLogEntry {
  hintNumber: number;
  mode: HintMode;
  hintType: HintType;
  codeStateHash: string;
  aiObservation: string;
  misconception: string | null;
  isLateral: boolean;
  compilerStatus: string | null;
  consecutiveSignalsAtTime: number;
  userFeedback: boolean | null;
  feedbackAt: Date | null;
  timestamp: Date;
}

// Response Types used in frontend
export interface HintResponse {
  hint: string;
  hintsGiven: number;
  quotaRemaining: number;
  patternCard?: PatternCard | null;
  structuredReveal: StructuredReveal | null;
  reflectionQuestion?: string | null;
  sessionId: string;
  hintType: HintType;
  isZeroCost: boolean;
}

export interface TestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime: number;
  statusDescription: string;
}

export interface ExecuteResponse {
  testResults: TestResult[];
  allPassed: boolean;
  lastRunPassed: boolean;
  hiddenTestFailed: boolean;
}
