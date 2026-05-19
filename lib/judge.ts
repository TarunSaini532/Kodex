const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  cpp: 54,
  "c++": 54,
  c: 50,
};

const STATUS_DESCRIPTIONS: Record<number, string> = {
  3: "Accepted",
  4: "Wrong Answer",
  5: "Time Limit Exceeded",
  6: "Compilation Error",
  7: "Runtime Error",
  8: "Runtime Error",
  9: "Runtime Error",
  10: "Runtime Error",
  11: "Runtime Error",
  12: "Runtime Error",
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

function normalizeStatus(statusId: number): NormalizedStatus {
  if (statusId === 3) return "Accepted";
  if (statusId === 4) return "Wrong Answer";
  if (statusId === 5) return "TLE";
  if (statusId === 6) return "Compilation Error";
  if (statusId >= 7 && statusId <= 12) return "Runtime Error";
  return null;
}

function getJudge0URL(): string {
  const url = process.env.JUDGE0_URL;
  if (!url) throw new Error("JUDGE0_URL not set in environment");
  return url;
}

async function runSingleTest(
  sourceCode: string,
  languageId: number,
  input: string,
  expectedOutput: string,
): Promise<TestCaseResult> {
  const judge0Url = getJudge0URL();
  const res = await fetch(
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
    },
  );

  if (!res.ok) {
    throw new Error(
      `Judge0 submission failed: HTTP ${res.status} — is the EC2 instance running?`,
    );
  }
  const data = await res.json();
  const statusId: number = data.status?.id ?? 0;
  const normalizedStatus = normalizeStatus(statusId);
  const actualOutput = (data.stdout ?? "").trim();
  const stderr = data.stderr ?? data.compile_output ?? null;
  const passed = statusId === 3;

  return {
    passed,
    input: input,
    expectedOutput: expectedOutput.trim(),
    actualOutput,
    executionTimeMs: data.time ? parseFloat(data.time) * 1000 : 0,
    statusDescription: STATUS_DESCRIPTIONS[statusId] ?? "Unknown",
    normalizedStatus,
    stderr: stderr || null,
  };
}

async function runTestCase(
  source_code: string,
  language: string,
  testCases: { input: string; expectedOutput: string }[],
): Promise<RunResult> {
  const languageId = LANGUAGE_IDS[language.toLowerCase()];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }
  const results = await Promise.all(
    testCases.map((tc) =>
      runSingleTest(source_code, languageId, tc.input, tc.expectedOutput).catch(
        (err): TestCaseResult => {
          console.error("[judge] Single test failed:", err);
          return {
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: "",
            executionTimeMs: 0,
            statusDescription: "Execution Error",
            normalizedStatus: null,
            stderr: err.message ?? "Unknown error",
          };
        },
      ),
    ),
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
  const overallStatus: NormalizedStatus = allPassed
    ? "Accepted"
    : (firstFailure?.normalizedStatus ?? null);

  return { results, allPassed, firstFailure, overallStatus };
}
