import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error("Upstash Redis Rest url is not defined in .env.local");
}

if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("Upstash Redis Rest token is not defined in .env.local");
}
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisClient;
}

export default getRedisClient;

const redis = getRedisClient();

// const DAILY_LIMIT = 50;

type QuotaType = "hint" | "concept";

const QUOTA_CONFIG = {
  hint: { prefix: "quota", limit: 50 },
  concept: { prefix: "concepts", limit: 5 },
};
function getQuotaKey(userId: string, type:QuotaType): string {
  const today = new Date().toISOString().split("T")[0];
  const prefix = QUOTA_CONFIG[type].prefix;
  return `${prefix}:${userId}:${today}`; // unique per user per day
}

// INTERFACES
export interface RedisQuotaResult {
  allowed: boolean;
  hintsUsedToday: number;

  hintsRemaining: number;
  //isNewDay: boolean;
  // isNewDay removed — nothing uses it yet
  // Redis TTL handles the reset automatically
  // Add back if frontend needs "fresh day" notification
}

export interface QuotaStatusResult {
  hintsUsedToday: number;
  hintsRemaining: number;
  dailyLimit: number;
}

export interface QuotaInfo {
  hintsUsedToday: number;
  hintsRemaining: number;
  dailyLimit: number;
  allowed: boolean;
}
// Quota Operations

export async function incrementQuota(userId: string, type:QuotaType): Promise<number> {
  const key = getQuotaKey(userId, type);
  // we are going to use redis.incr() function that is internally comes with redis
  // It is Atomic which means read+increment+write happens as one operation
  // what internally happens is
  // 1. if key does'nt exist: create it with value 0
  // 2. Add 1 to the current value
  // 3. return to new value
  // this atomicity of the incr() function also prevents race condition
  const newVal = await redis.incr(key);

  if (newVal == 1) {
    //   const now = new Date();
    //   const midnight = new Date();
    //   midnight.setUTCHours(24, 0, 0, 0);
    //   const secondsUntilMidnight = Math.floor(
    //     (midnight.getTime() - now.getTime()) / 1000,
    //   );
    await redis.expire(key, 86400);
  }
  return newVal;
}

// This is the combined function of the both the task
export async function getQuota(userId: string,type:QuotaType): Promise<QuotaInfo> {
  const key = getQuotaKey(userId, type);
  const curr = await redis.get<number>(key);

  const hintsUsed = curr ?? 0;

 const limit = QUOTA_CONFIG[type].limit;

return {
  hintsUsedToday: hintsUsed,
  hintsRemaining: Math.max(0, limit - hintsUsed),
  dailyLimit: limit,
  allowed: hintsUsed < limit,
};
}

//   export async function checkQuota(userId: string): Promise<RedisQuotaResult> {
//   const key = getQuotaKey(userId);

//   const current = await redis.get<number>(key);

//   const hintsUsed = current ?? 0;
//   const allowed = hintsUsed < DAILY_LIMIT;
//   return {
//     allowed,
//     hintsUsedToday: hintsUsed,
//     hintsRemaining: Math.max(0, DAILY_LIMIT - hintsUsed),
//   };
// }

//   export async function getQuotaStatus(userId: string): Promise<QuotaStatusResult>{
//     const key = getQuotaKey(userId);

//     const curr = await redis.get<number>(key);
//     const hintsUsed = curr??0;
//     return {
//         hintsUsedToday: hintsUsed,
//         hintsRemaining: Math.max(DAILY_LIMIT-hintsUsed, 0),
//         dailyLimit: DAILY_LIMIT
//     }
//   }
