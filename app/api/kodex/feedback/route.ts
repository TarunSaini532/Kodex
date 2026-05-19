import { getTokenFromRequest } from "@/lib/auth";
import { isKillSwitchActive } from "@/lib/KillSwitch";
import connectDB from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

async function POST(req:NextRequest) {
    const payload = getTokenFromRequest(req);
    if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = payload;
  if(await isKillSwitchActive("telemetry")){
    return NextResponse.json({
        saved: false,
        skipped: true,
    })
  }
  let body:{sessionId: string, hintNumber: number, helpful: boolean};
  try{
    body =await req.json();

  }catch{
    return NextResponse.json({
        error:"Invalid Request Body"
    }, {status: 400})
  }

  const{sessionId, hintNumber, helpful} = body;
   if (!sessionId || hintNumber === undefined || helpful === undefined) {
    return NextResponse.json(
      { error: "sessionId, hintNumber, and helpful are required" },
      { status: 400 }
    );
  }

  await connectDB();
}