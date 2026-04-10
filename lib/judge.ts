const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  "c++": 54,
};

export interface ExecuteRequest {
  code: string;
  language: string;
  testInput: string;
}

export interface ExecuteResponse {
  passed: boolean;
  actualOutput: string;
  expectedOutput: string;
  executionTime: string;
  error: string | null;
  statusDescription: string;
}

const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1000;

async function submitCode(req: ExecuteRequest): Promise<string> {
  const languageId = LANGUAGE_IDS[req.language.toLowerCase()];

  if (!languageId) {
    throw new Error(`Unsupported Language: ${req.language}`);
  }

  const encodedCode = Buffer.from(req.code).toString("base64");
  const encodedInput = Buffer.from(req.testInput).toString("base64");

  const response = await fetch(
    "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": process.env.JUDGE0_API_KEY!,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
      body: JSON.stringify({
        language_id: languageId,
        source_code: encodedCode,
        stdin: encodedInput,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Judge0 submission failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error("Judge0 did not return a submission token");
  }

  return data.token;
}

// Judge0 status_id meanings:
//   1 = In Queue
//   2 = Processing
//   3 = Accepted (correct output)
//   4 = Wrong Answer
//   5 = Time Limit Exceeded
//   6 = Compilation Error
//   11+ = Runtime errors

async function pollResult(token: string): Promise<any> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const response = await fetch(
      `https://judge0-ce.p.rapidapi.com/submissions/${token}?base64_encoded=true`,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": process.env.JUDGE0_API_KEY!,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Judge0 poll failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.status?.id > 2) {
      return data;
    }
  }
  throw new Error("Judge0 execution timed out after 10 seconds");
}

function decode(base64: string | null): string {
  if (!base64) return "";
  return Buffer.from(base64, "base64").toString("utf-8").trim();
}

export async function executeCode(
  req: ExecuteRequest,
  expectedOutput: string,
): Promise<ExecuteResponse> {
  try {
    const token = await submitCode(req);
    const res = await pollResult(token);

    const actualOutput = decode(res.stdout);
    const errorOutput = decode(res.stderr) || decode(res.compile_output);
    const statusDesc = res.status?.description ?? "Unknown";
    const execTime = res.time ? `${res.time}s` : "N/A";

    const passed = actualOutput === expectedOutput.trim();
    return {
      passed,
      actualOutput,
      expectedOutput: expectedOutput.trim(),
      executionTime: execTime,
      error: errorOutput || null,
      statusDescription: statusDesc,
    };
  } catch (err: any) {
    console.error("[Judge0] Execution error:", err);

    return {
      passed: false,
      actualOutput: "",
      expectedOutput: expectedOutput.trim(),
      executionTime: "N/A",
      error: err.message ?? "Execution failed",
      statusDescription: "Error",
    };
  }
}
