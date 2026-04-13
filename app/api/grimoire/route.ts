import { getTokenFromRequest } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Session from "@/models/Session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
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
    const session = await Session.find({
      userId: token.userId,
      solved: true,
      patternCard: { $ne: null },
    })
      .sort({ hintsGiven: 1 })
      .select("patternCard hintsGiven");

    const seen = new Set<string>();
    const grimoire = session
      .filter((s) => {
        if (seen.has(s.patternCard.patternName)) return false;
        seen.add(s.patternCard.patternName);
        return true;
      })
      .map((s) => s.patternCard);

    return NextResponse.json(
      {
        success: true,
        grimoire,
      },
      { status: 200 },
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
