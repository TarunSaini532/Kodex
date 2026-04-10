import { IUser } from "@/models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET not set in .env.local");
}
// Password Utilities
export async function hashPassword(password: string): Promise<string> {
  const saltRound = 12;
  return bcrypt.hash(password, saltRound);
}

export async function comparePassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

//JWT utilities
export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}

// Request Auth Helper
export function getTokenFromRequest(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  return verifyToken(token);
}

// This was the v1 which I update directly onto mongodb for the quota but i used redis for fast execution and it was frequently accessed data in our application 
//mongodb takes  1-5ms with a network round trip to atlas, redis reads from upstash and takes under 0.5 ms. beyond this redis have ttl which is perfect for our daily quota to reset 
// everyday without any external query, it will automatically expire the key after ttl is hit.
// //Daily Quota Utilities
// const DAILY_HINT_LIMIT = 50;

// function getTodayString(): string {
//   return new Date().toISOString().split("T")[0];
//   // toISOString() → "2024-04-04T14:30:00.000Z"
// }

// export interface QuotaStatus {
//   allowed: boolean;
//   hintsUsedToday: number;
//   hintsRemaining: number;
//   resetAt: string;
// }
// export interface QuotaCheckResult{
//   allowed: boolean;
//   updateQuery: object;
//   hintsRemaining: number;
//   hintsUsedToday: number;
// }

// export function checkAndUpdateQuota(user: IUser): QuotaCheckResult {
//   const today = getTodayString();
//   const isNewDay = user.lastHintDate !== today;
//   //if new day  then reset counter

//   const currentUsage = isNewDay ? 0 : user.hintsUsedToday;
//   const allowed = currentUsage < DAILY_HINT_LIMIT;

//   if (!allowed) {
//     return {
//       allowed: false,
//       updateQuery: {},
//       hintsRemaining: 0,
//       hintsUsedToday: currentUsage,
//     };
//   }

//   const updateQuery = isNewDay
//     ? {
//         $set: { hintsUsedToday: 1, lastHintDate: today },
//         $in: { totalHintsUsed: 1 },
//       }
//     : {
//         $inc: { hintsUsedToday: 1, totalHintsUsed: 1 },
//       };
//   return {
//     allowed: true,
//     updateQuery,
//     hintsRemaining: DAILY_HINT_LIMIT - currentUsage - 1,
//     hintsUsedToday: currentUsage + 1,
//   };
// }
