import { env } from "./env";

const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  cpp: 54,
  "c++": 54,
  c: 50,
};


const STATUS_MAP: Record<
  number,
  { description: string; normalized: NormalizedStatus }
> = {
  3: { description: "Accepted", normalized: "Accepted" },
  4: { description: "Wrong Answer", normalized: "Wrong Answer" },
  5: { description: "Time Limit Exceeded", normalized: "TLE" },
  6: { description: "Compilation Error", normalized: "Compilation Error" },
  7: { description: "Runtime Error", normalized: "Runtime Error" },
  8: { description: "Runtime Error", normalized: "Runtime Error" },
  9: { description: "Runtime Error", normalized: "Runtime Error" },
  10: { description: "Runtime Error", normalized: "Runtime Error" },
  11: { description: "Runtime Error", normalized: "Runtime Error" },
  12: { description: "Runtime Error", normalized: "Runtime Error" },
};

export type NormalizedStatus =
  | "Accepted"
  | "Wrong Answer"
  | "TLE"
  | "Runtime Error"
  | "Compilation Error"
  | null;

export interface TestCaseResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTimeMs: number;
  statusDescription: string;
  normalizedStatus: NormalizedStatus;
  stderr: string | null;
}
export interface RunResult {
  results: TestCaseResult[];
  allPassed: boolean;
  firstFailure: FirstFailure | null;
  overallStatus: NormalizedStatus;
}

export interface FirstFailure {
  normalizedStatus: NormalizedStatus;
  stderr: string | null;
  input: string;
  expectedOutput: string;
  actualOutput: string;
}

const EXECUTION_CONFIG = {
  timeoutMs: 10_000,
  maxParallelExecutions: 5,
} as const;

function normalizeStatus(statusId: number): NormalizedStatus {
  if (statusId === 3) return "Accepted";
  if (statusId === 4) return "Wrong Answer";
  if (statusId === 5) return "TLE";
  if (statusId === 6) return "Compilation Error";
  if (statusId >= 7 && statusId <= 12) return "Runtime Error";
  return null;
}

function getJudge0URL(): string {
  const url = env.JUDGE0_URL;
  if (!url) throw new Error("JUDGE0_URL not set in environment");
  return url;
}

function getStatusDescription(statusId: number): string {
  return STATUS_MAP[statusId]?.description ?? `Unknown (${statusId})`;
}

async function executeSingleTestCase(
  sourceCode: string,
  languageId: number,
  input: string,
  expectedOutput: string,
): Promise<TestCaseResult> {
  const judge0Url = getJudge0URL();
  let res: Response;
  try {
    res = await fetch(
      `${judge0Url}/submissions?base64_encoded=false&wait=true`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: sourceCode,
          language_id: languageId,
          stdin: input,
          expected_output: expectedOutput,
        }),
        signal: AbortSignal.timeout(EXECUTION_CONFIG.timeoutMs),
      },
    );
  } catch (err: any) {
    const isTimeout = err.name === "AbortError" || err.name === "TimeoutError";

    throw new ExecutionError(
      isTimeout
        ? `Judge0 timed out after ${EXECUTION_CONFIG.timeoutMs / 1000}s — ` +
            `EC2 instance may be overloaded or frozen`
        : `Judge0 unreachable: ${err.message}`,
      isTimeout ? "timeout" : "network",
    );
  }
  if (!res.ok) {
    throw new ExecutionError(
      `Judge0 HTTP ${res.status} — ` +
        `is the EC2 instance running at ${judge0Url}?`,
      "http_error",
    );
  }

  const data = await res.json();
  const statusId: number = data.status?.id ?? 0;

  return {
    passed: statusId === 3,
    input,
    expectedOutput: expectedOutput.trim(),
    actualOutput: (data.stdout ?? "").trim(),
    executionTimeMs: data.time ? parseFloat(data.time) * 1000 : 0,
    statusDescription: getStatusDescription(statusId),
    normalizedStatus: normalizeStatus(statusId),
    stderr: data.stderr || data.compile_output || null,
  };
}

export class ExecutionError extends Error {
  constructor(
    message: string,
    public readonly type:
      | "timeout"
      | "network"
      | "http_error"
      | "unsupported_language",
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

async function runInBatches<T>(
  items: T[],
  fn: (item: T) => Promise<TestCaseResult>,
  batchSize: number,
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}
class ExecutionOrchestrator {
  async runTestCases(
    sourceCode: string,
    language: string,
    testCases: { input: string; expectedOutput: string }[],
  ): Promise<RunResult> {
    const languageId = LANGUAGE_IDS[language.toLowerCase()];
    if (!languageId) {
      throw new ExecutionError(
        `Unsupported language: ${language}. ` +
          `Supported: ${Object.keys(LANGUAGE_IDS).join(", ")}`,
        "unsupported_language",
      );
    }

    const results = await runInBatches(
      testCases,
      (tc) =>
        executeSingleTestCase(
          sourceCode,
          languageId,
          tc.input,
          tc.expectedOutput,
        ).catch((err): TestCaseResult => {
          // Individual test failure is non-fatal for the batch
          // Timeout on one test case doesn't kill the rest
          console.error("[judge] Single test execution failed:", err);
          return {
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: "",
            executionTimeMs: 0,
            statusDescription:
              err instanceof ExecutionError && err.type === "timeout"
                ? "Execution Timeout"
                : "Execution Error",
            normalizedStatus:
              err instanceof ExecutionError && err.type === "timeout"
                ? "TLE"
                : "Runtime Error",
            stderr: err.message ?? "Unknown error",
          };
        }),
      EXECUTION_CONFIG.maxParallelExecutions,
    );

    const allPassed = results.every((r) => r.passed);

    const firstFailureResult = results.find((r) => !r.passed);
    const firstFailure: FirstFailure | null = firstFailureResult
      ? {
          normalizedStatus: firstFailureResult.normalizedStatus,
          stderr: firstFailureResult.stderr,
          input: firstFailureResult.input,
          expectedOutput: firstFailureResult.expectedOutput,
          actualOutput: firstFailureResult.actualOutput,
        }
      : null;

    return {
      results,
      allPassed,
      firstFailure,
      overallStatus: allPassed
        ? "Accepted"
        : (firstFailure?.normalizedStatus ?? null),
    };
  }
}

// Future: async BullMQ queue → Judge0 CE → result store

const orchestrator = new ExecutionOrchestrator();

export async function runTestCases(
  sourceCode: string,
  language: string,
  testCases: { input: string; expectedOutput: string }[],
): Promise<RunResult> {
  return orchestrator.runTestCases(sourceCode, language, testCases);
}
