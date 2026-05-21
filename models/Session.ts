import { BeltLevel, HintLogEntry, HintType, TestResult } from "@/types/kodex";
import mongoose, { Document, mongo, Schema } from "mongoose";

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  problemSlug: string;
  userCode: string;
  sessionVersion: number;
  language: string;
  studentApproach: string;
  approachValidated: boolean;
  pattern: DSAPattern;
  hintsGiven: number;
  currentMode: HintMode;
  nudgesReceived: number;
  solved: boolean;
  status: SessionStatus;
  lastRunPassed: boolean;
  testResults: ITestResult[];
  patternCard: IPatternCard | null;
  structuredReveal: IStructuredReveal | null;
  tradeoffQuestion: string | null;
  beltAtSessionStart: BeltLevel;
  constraintCoachDone: boolean;
  comprehensionCoachDone: boolean;
  approachType: "brute_force" | "optimal" | null;
  currentCodeHash: string;
  codeHistory: string[];
  lastMeaningfulChangeAt: Date;
  contextDriftDetected: boolean;
  // compiler result
  lastExecutionResult: LastExecutionResult;
  hiddenTestFailed: boolean;
  tleCount: number;
  consecutiveSignalCount: Map<string, number>;
  hintTimeStamps: Date[];
  cooldownUntil: Date | null;
  logicTrapPending: boolean;
  logicTrapQuestion: string | null;
  lastActivityAt: Date;
  isFrustrated: boolean;
  inactivityNudgeCount: number;
  assistedSolve: boolean;
  reflectionAnswer: string | null;
  hintLog: HintLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

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

export type SessionStatus = "active" | "solved" | "revisit";

export type HintMode = "socratic" | "structured_reveal" | "code_correction";

export interface ITestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime: Number;
  statusDescription: string;
}

export interface LastExecutionResult {
  status: "TLE" | "Runtime Error" | "Wrong Answer" | "Accepted" | null;
  stderr: string | null;
  failedTestInput: string | null;
  failedExpected: string | null;
  failedActual: string | null;
}

export interface IPatternCard {
  patternName: string;
  signals: string[];
  oneLineSummary: string;
}

export interface IStructuredReveal {
  patternName: string;
  keyInsight: string;
  approach: string[];
  yourTurn: string;
  commonMistake: string;
}

const TestResultSchema = new Schema<ITestResult>(
  {
    passed: { type: Boolean, required: true },
    input: { type: String, default: "" },
    expectedOutput: { type: String, default: "" },
    actualOutput: { type: String, default: "" },
    executionTime: { type: Number, default: 0 },
    statusDescription: { type: String, default: "" },
  },
  { _id: false },
);

const PatternCardSchema = new Schema<IPatternCard>(
  {
    patternName: { type: String, required: true },
    signals: {
      type: [String],
      validate: {
        validator: (arr: string[]) => arr.length == 3,
        message: "PatternCard.signals must have 3 enteries ",
      },
    },
    oneLineSummary: { type: String, required: true },
  },
  { _id: false },
);
const StructuredRevealSchema = new Schema<IStructuredReveal>(
  {
    patternName: { type: String, required: true },
    keyInsight: { type: String, required: true },
    approach: { type: [String], default: [] },
    yourTurn: { type: String, required: true },
    commonMistake: { type: String, required: true },
  },
  { _id: false },
);

const LastExecutionResultSchema = new Schema<LastExecutionResult>(
  {
    status: {
      type: String,
      enum: ["TLE", "Runtime Error", "Wrong Answer", "Accepted", null],
      default: null,
    },
    stderr: { type: String, default: null },
    failedTestInput: { type: String, default: null },
    failedActual: { type: String, default: null },
    failedExpected: { type: String, default: null },
  },
  { _id: false },
);

const HintLogEntrySchema = new Schema<HintLogEntry>(
  {
    hintNumber: { type: Number, required: true },
    mode: { type: String, required: true },
    hintType: { type: String, required: true },
    codeStateHash: { type: String, required: true },
    aiObservation: { type: String, default: "" },
    misconception: { type: String, default: null },
    isLateral: { type: Boolean, default: false },
    compilerStatus: { type: String, default: null },
    consecutiveSignalsAtTime: { type: Number, default: 0 },
    userFeedback: { type: Boolean, default: null },
    feedbackAt: { type: Date, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sessionVersion: { type: Number, default: 0 },
    problemSlug: {
      type: String,
      required: true,
    },
    userCode: {
      type: String,
      required: true,
      default: "",
    },
    language: {
      type: String,
      default: "java",
      enum: ["javascript", "python", "java", "c++"],
    },
    studentApproach: {
      type: String,
      default: "",
    },
    approachValidated: {
      type: Boolean,
      default: false,
    },
    hintsGiven: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    currentMode: {
      type: String,
      enum: [
        "approach_validation",
        "socratic",
        "structured_reveal",
        "code_correction",
        "check_in",
      ],
      default: "socratic",
    },
    nudgesReceived: {
      type: Number,
      default: 0,
    },
    pattern: {
      type: String,
      enum: [
        "sliding window",
        "two pointers",
        "fast and slow pointers",
        "dynamic programming",
        "binary search",
        "depth first search",
        "breadth first search",
        "backtracking",
        "greedy",
        "heap",
        "other",
      ],
      default: "other",
    },

    solved: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "solved", "revisit"],
      default: "active",
    },
    lastRunPassed: { type: Boolean, default: false },
    testResults: { type: [TestResultSchema], default: [] },
    patternCard: { type: PatternCardSchema, default: null },
    structuredReveal: { type: StructuredRevealSchema, default: null },
    tradeoffQuestion: { type: String, default: null },
    beltAtSessionStart: {
      type: String,
      enum: ["white", "brown", "black", "yellow", "green"],
      default: "white",
    },
    constraintCoachDone: { type: Boolean, default: false },
    comprehensionCoachDone: { type: Boolean, default: false },
    approachType: {
      type: String,
      enum: ["brute_force", "optimal", null],
      default: null,
    },
    currentCodeHash: { type: String, default: null },
    codeHistory: { type: [String], default: [] },
    lastMeaningfulChangeAt: { type: Date, default: Date.now },
    contextDriftDetected: { type: Boolean, default: false },
    lastExecutionResult: {
      type: LastExecutionResultSchema,
      default: () => ({
        status: null,
        stderr: null,
        failedTestInput: null,
        failedExpected: null,
        failedActual: null,
      }),
    },
    hiddenTestFailed: { type: Boolean, default: false },
    tleCount: { type: Number, default: 0 },

    consecutiveSignalCount: {
      type: Map,
      of: Number,
      default: {},
    },
    hintTimeStamps: { type: [Date], default: [] },
    cooldownUntil: { type: Date, default: null },
    logicTrapPending: { type: Boolean, default: false },
    logicTrapQuestion: { type: String, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    isFrustrated: { type: Boolean, default: false },
    inactivityNudgeCount: { type: Number, default: 0 },
    assistedSolve: { type: Boolean, default: false },
    reflectionAnswer: { type: String, default: null },
    hintLog: {
      type: [HintLogEntrySchema],
      default: [],
    },
  },
  { timestamps: true },
);

SessionSchema.index({ userId: 1, problemSlug: -1 });
SessionSchema.index({ userId: 1, status: 1 });

const Session =
  mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema);
export default Session;
