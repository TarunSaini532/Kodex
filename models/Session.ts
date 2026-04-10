import mongoose, { Document, mongo, Schema } from "mongoose";

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  problemSlug: string;
  userCode: string;
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
  executionTime: string;
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

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    lastRunPassed: {
      type: Boolean,
      default: false,
    },
    testResults: {
      type: [
        {
          passed: { type: Boolean },
          input: { type: String },
          expectedOutput: { type: String },
          actualOutput: { type: String },
          executionTime: { type: String },
        },
      ],
      default: [],
    },
    patternCard: {
      patternName: { type: String },
      signals: [{ type: String }],
      oneLineSummary: { type: String },
      _id: false,
    },
    structuredReveal: {
      patternName: { type: String },
      keyInsight: { type: String },
      approach: [{ type: String }],
      yourTurn: { type: String },
      commonMistake: { type: String },
      _id: false,
    },
    tradeoffQuestion: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

SessionSchema.index({ userId: 1, createdAt: -1 });
SessionSchema.index({ userId: 1, pattern: 1 });

const Session =
  mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema);
export default Session;
