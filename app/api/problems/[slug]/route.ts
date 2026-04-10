import { getTokenFromRequest } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Problem from "@/models/Problem";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Please log in",
        },
        { status: 401 },
      );
    }

    await connectDB();
    const { slug } = await params;
    const problem = await Problem.findOne({ slug }).select("-pattern");
    if (!problem) {
      return NextResponse.json(
        {
          success: false,
          message: "problem not found",
        },
        { status: 404 },
      );
    }
    const doc = problem.toObject();
    doc.testCases = doc.testCases.filter((tc: any) => !tc.isHidden);
    return NextResponse.json({ success: true, problem: doc }, { status: 200 });
  } catch (error) {
    console.error("[Problem Slug] error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
