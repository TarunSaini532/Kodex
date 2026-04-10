import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { KnownConcept, ExperienceLevel } from "@/models/User";
import { getTokenFromRequest } from "@/lib/auth";

const VALID_CONCEPTS: KnownConcept[] = [
  "arrays",
  "hashmaps",
  "recursion",
  "sorting",
  "linked lists",
  "trees",
  "graphs",
  "dynamic programming",
];

const VALID_LEVELS: ExperienceLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];

interface ProfileUpdateBody {
  knownConcepts?: KnownConcept[];
  experienceLevel?: ExperienceLevel;
}

export async function GET(request: NextRequest) {
  try {
    const tokenPayload = getTokenFromRequest(request);

    if (!tokenPayload) {
      return NextResponse.json(
        { success: false, message: "Please log in" },
        { status: 401 },
      );
    }

    await connectDB();
    const user = await User.findById(tokenPayload.userId).select(
      "name email knownConcepts experienceLevel createdAt",
    );
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        profile: {
          name: user.name,
          email: user.email,
          knownConcepts: user.knownConcepts,
          experienceLevel: user.experienceLevel,
          memberSince: user.createdAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tokenPayload = getTokenFromRequest(request);

    if (!tokenPayload) {
      return NextResponse.json(
        { success: false, message: "Please log in" },
        { status: 401 },
      );
    }

    const body: ProfileUpdateBody = await request.json();
    const { knownConcepts, experienceLevel } = body;

    const updateFields: Partial<{
      knownConcepts: KnownConcept[];
      experienceLevel: ExperienceLevel;
    }> = {};

    if (knownConcepts != undefined) {
      updateFields.knownConcepts = knownConcepts.filter(
        (c): c is KnownConcept => VALID_CONCEPTS.includes(c),
      );
    }
    if (experienceLevel !== undefined) {
      if (!VALID_LEVELS.includes(experienceLevel)) {
        return NextResponse.json(
          { success: false, message: "Invalid experience level" },
          { status: 400 },
        );
      }
      updateFields.experienceLevel = experienceLevel;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        {
          success: "false",
          message: "No valid fields to update",
        },
        { status: 400 },
      );
    }
    await connectDB();

    const updatedUser = await User.findByIdAndUpdate(
      tokenPayload.userId,
      { $set: updateFields },
      { new: true },
    ).select("name email knownConcepts experienceLevel");

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Profile updated successfully",
        profile: {
          name: updatedUser.name,
          email: updatedUser.email,
          knownConcepts: updatedUser.knownConcepts,
          experienceLevel: updatedUser.experienceLevel,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
