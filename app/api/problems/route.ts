import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Problem from "@/models/Problem";
import { getTokenFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get("difficulty");
    const topic = searchParams.get("topic");
    const status = searchParams.get("status");

    await connectDB();

    const filter: any = {};
    if (difficulty) filter.difficulty = difficulty;
    if (topic) filter.topic = topic;
    if (status) filter.status = status;

    const problems = await Problem.find(filter)
      .select("-pattern")
      .sort({ topicOrder: 1, problemOrder: 1 });

    return NextResponse.json(
      {
        success: true,
        problems,
        total: problems.length,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
