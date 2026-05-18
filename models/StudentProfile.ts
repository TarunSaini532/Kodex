import { BeltLevel, DSAPattern } from "@/types/kodex";
import mongoose, { Model, models, mongo, Schema } from "mongoose";

export interface PatternStat {
  attempted: number;
  solved: number;
  avgHintsNeeded: number;
  lastMiconception: string | null;
  lastAttemptedAt: Date;
}

export interface RevisitItem {
  problemSlug: string;
  siblingSlug: string | null;
  dueAt: Date;
  revisitNumber: 1 | 2 | 3;
}

export interface IStudentProfile extends Document {
  userId: mongoose.Types.ObjectId;
  belt: BeltLevel;
  beltUpdatedAt: Date;
  totalAttempted: number;
  totalSolved: number;
  totalHintsUsed: number;
  patternData: Map<string, PatternStat>;
  recurringMistakes: string[];
  strongPatterns: DSAPattern[];
  revisitQueue: RevisitItem[];
  lastUpdated: Date;
}

const PatternStatSchema = new Schema<PatternStat>(
  {
    attempted: { type: Number, default: 0 },
    solved: { type: Number, default: 0 },
    avgHintsNeeded: { type: Number, default: 0 },
    lastMiconception: { type: String, default: null },
    lastAttemptedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const RevisitItemSchema = new Schema<RevisitItem>(
  {
    problemSlug: { type: String, required: true },
    siblingSlug: { type: String, default: null },
    dueAt: { type: Date, required: true },
    revisitNumber: { type: Number, enum: [1, 2, 3], required: true },
  },
  { _id: false },
);

const StudentProfileSchema = new Schema<IStudentProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    belt: {
      type: String,
      enum: ["white", "yellow", "green", "black", "brown"],
      default: "white",
    },
    beltUpdatedAt: { type: Date, default: Date.now },
    totalAttempted: { type: Number, default: 0 },
    totalSolved: { type: Number, default: 0 },
    totalHintsUsed: { type: Number, default: 0 },
    patternData: {
      type: Map,
      of: PatternStatSchema,
      default: {},
    },
    recurringMistakes: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= 10,
        message: "recurringMistake is capped at 10 entries",
      },
    },
    strongPatterns: {
      type: [String],
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
      default: [],
    },
    revisitQueue: {
      type: [RevisitItemSchema],
      default: [],
    },
    lastUpdated: {
      type: Date,
      default: Date.now(),
    },
  },
  {
    timestamps: false,
  },
);

StudentProfileSchema.index({ "revisitQueue.dueAt": 1 });

const StudentProfile: Model<IStudentProfile> =
  mongoose.models.StudentProfile ||
  mongoose.model<IStudentProfile>("StudentProfile", StudentProfileSchema);

  export default StudentProfile;