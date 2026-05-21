import mongoose, { Document, Schema } from "mongoose";
import { DSAPattern } from "./Session";

export type Difficulty = "easy" | "medium" | "hard";

export interface IProblem extends Document {
  title: string;
  slug: string;
  difficulty: Difficulty;
  topic: string;
  topicOrder: number;
  problemOrder: number;
  description: string;
  examples: string[];
  contraints: string[];
  pattern: DSAPattern;
  leetcodeUrl: string;
  siblingProblem: string[];
  testCases: ITestCase[];
  status: "pending" | "approved" | "rejected";
  submittedBy: mongoose.Types.ObjectId | null;
  source: string;
  createdAt: Date;
}

export interface ITestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

const ProblemSchema = new Schema<IProblem>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    difficulty: {
      type: String,
      required: true,
      enum: ["easy", "medium", "hard"],
    },

    topic: {
      type: String,
      required: true,
    },
    topicOrder: {
      type: Number,
      required: true,
    },
    problemOrder: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    examples: [
      {
        type: String,
      },
    ],
    contraints: [{ type: String }],
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
      required: true,
    },
    leetcodeUrl: {
      type: String,
      default: "",
    },
    siblingProblem: {
      type: [String],
      default: [],
    },
    testCases: [
      {
        input: String,
        expectedOutput: String,
        isHidden: { type: Boolean, default: false },
        _id: false,
      },
    ],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    source: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

ProblemSchema.index({ topicOrder: 1, problemOrder: 1 });
ProblemSchema.index({ status: 1 });

ProblemSchema.index({ difficulty: 1, pattern: 1 });

const Problem: mongoose.Model<IProblem> =
  mongoose.models.Problem || mongoose.model<IProblem>("Problem", ProblemSchema);

export default Problem;
