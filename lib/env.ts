function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `[env] Missing required environment variable: ${key}\n` +
        `Check your .env.local file.`,
    );
  }
  return value.trim();
}

function requireEnvUrl(key: string): string {
  const value = requireEnv(key);
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`[env] ${key} must be a valid URL. Got: "${value}"`);
  }
}

export const env = {
  MONGODB_URI: requireEnvUrl("MONGODB_URI"),
  JWT_SECRET: requireEnv("JWT_SECRET"),
  GROQ_API_KEY: requireEnv("GROQ_API_KEY"),
  UPSTASH_REDIS_REST_URL: requireEnvUrl("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
  JUDGE0_URL: requireEnvUrl("JUDGE0_URL"),
  NODE_ENV: (process.env.NODE_ENV ?? "development") as
    | "development"
    | "staging"
    | "production",
} as const;


export type Env = typeof env;

