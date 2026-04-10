import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, knownConcepts, experienceLevel } = body;

    const validLevels = ["beginner", "intermediate", "advanced"];
    const validConcepts = [
      "arrays",
      "hashmaps",
      "recursion",
      "sorting",
      "linked lists",
      "trees",
      "graphs",
      "dynamic programming",
    ];

    const userExperienceLevel = validLevels.includes(experienceLevel)
      ? experienceLevel
      : "beginner";

    const userKnownConcepts = Array.isArray(knownConcepts)
      ? knownConcepts.filter((c) => validConcepts.includes(c))
      : [];

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, email and password are required",
        },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 6 characters",
        },
        { status: 400 },
      );
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: " Enter a valid email",
        },
        {
          status: 400,
        },
      );
    }

    await connectDB();

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "An account with this email already exists",
        },
        {
          status: 409,
        },
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      knownConcepts: userKnownConcepts,
      experienceLevel: userExperienceLevel,
    });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account Created Successfully",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      },
      {
        status: 201,
      },
    );
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong, Please try again",
      },
      { status: 500 },
    );
  }
}
