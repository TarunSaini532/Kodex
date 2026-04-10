import mongoose, { Document, Schema } from "mongoose";

export type KnownConcept =
  | "arrays"
  | "hashmaps"
  | "recursion"
  | "sorting"
  | "linked lists"
  | "trees"
  | "graphs"
  | "dynamic programming";

export type ExperienceLevel =
  | "beginner" // 0-20 problems
  | "intermediate" // 20-100 problems
  | "advanced"; // 100+ problems

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  knownConcepts: KnownConcept[];
  experienceLevel: ExperienceLevel;
  role: "student" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    knownConcepts: {
      type: [String],
      enum: [
        "arrays",
        "hashmaps",
        "recursion",
        "sorting",
        "linked lists",
        "trees",
        "graphs",
        "dynamic programming",
      ],
      default: [],
      // Empty array = complete beginner
      // Fine — Claude handles this gracefully
    },
    experienceLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default User;
