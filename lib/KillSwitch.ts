import { headers } from "next/headers";

const KILL_SWITCHES = {
  static_analysis: "ks:static_analysis",
  run_first: "ks:run_first",
  compiler_reactive: "ks:compiler_reactive",
  pattern_pivot: "ks:pattern_pivot",
  logic_trap: "ks:logic_trap",
  gaming_detection: "ks:gaming_detection",
  nudge: "ks:nudge",
  telemetry: "ks:telemetry",
} as const;

export type KillSwitchKey = keyof typeof KILL_SWITCHES;

export async function isKillSwitchActive(
  feature: KillSwitchKey,
): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn(
      `[killSwitch] Redis not configured — ${feature} treated as active`,
    );
    return false;
  }

  const key = KILL_SWITCHES[feature];
  try {
    const res = await fetch(`${url}/get/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(500),
    });

    if (!res.ok) return false;

    const data = await res.json();

    return data.result === "1";
  } catch (err) {
    console.error(`[killSwitch] Failed to check ${feature}:`, err);
    return false;
  }
}


export async function checkKillSwitches(feature:KillSwitchKey[]):Promise<Record<KillSwitchKey, boolean>> {
    const result = await Promise.all(
        feature.map(async(f) => [f, await isKillSwitchActive(f)] as const)
    );
    return Object.fromEntries(result) as Record<KillSwitchKey, boolean>;
    
}
