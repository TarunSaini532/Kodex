// Contract Based Api which says if the request shape is not of this type then this is invalid
//Will add zod later if schemas get complex.

// API BOUNDARY VALIDATION 

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const VALID_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "c",
] as const;
type Language = (typeof VALID_LANGUAGES)[number];

const VALID_SLUG_PATTERN = /^[a-z0-9-]+$/;

function validateLanguage(lang: unknown): lang is Language {
  return VALID_LANGUAGES.includes(lang as Language);
}

function validateSlug(slug: unknown): slug is string {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= 100 &&
    VALID_SLUG_PATTERN.test(slug)
  );
}
function validateCode(code: unknown): code is string {
  return (
    typeof code === "string" && code.length <= 50_000 // 50KB max — no one writes 50KB solutions
  );
}

// hint request validation
export interface ValidatedHintRequest {
  problemSlug: string;
  userCode: string;
  language: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  sessionId: string | undefined;
  studentApproach: string;
  solved: boolean;
  reflectionAnswer: string | null;
}

export function validateHintRequest(
  body: unknown,
): ValidationResult<ValidatedHintRequest> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (!validateSlug(b.problemSlug)) {
    return {
      ok: false,
      error:
        "problemSlug must be a lowercase alphanumeric string with hyphens, max 100 chars",
    };
  }

  if (!validateCode(b.userCode ?? "")) {
    return { ok: false, error: "userCode exceeds 50KB limit" };
  }

  const language = (b.language ?? "javascript") as string;
  if (!validateLanguage(language)) {
    return {
      ok: false,
      error: `language must be one of: ${VALID_LANGUAGES.join(", ")}`,
    };
  }

  const studentApproach =
    typeof b.studentApproach === "string"
      ? b.studentApproach.slice(0, 2000) // truncate silently — not malicious
      : "";

  // Validate conversation history
  const rawHistory = Array.isArray(b.conversationHistory)
    ? b.conversationHistory
    : [];

  if (rawHistory.length > 20) {
    return {
      ok: false,
      error: "conversationHistory max length is 20 messages",
    };
  }

  const conversationHistory = rawHistory
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 5000), // truncate per message
    }));

  const sessionId =
    typeof b.sessionId === "string" && b.sessionId.length > 0
      ? b.sessionId
      : undefined;

  return {
    ok: true,
    data: {
      problemSlug: b.problemSlug as string,
      userCode: (b.userCode as string) ?? "",
      language,
      conversationHistory,
      sessionId,
      studentApproach,
      solved: b.solved === true,
      reflectionAnswer:
        typeof b.reflectionAnswer === "string" ? b.reflectionAnswer : null,
    },
  };
}

// execute request validation

export interface ValidatedExecuteRequest {
  problemSlug: string;
  userCode: string;
  language: string;
  sessionId: string | undefined;
}

export function validateExecuteRequest(
  body: unknown,
): ValidationResult<ValidatedExecuteRequest> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (!validateSlug(b.problemSlug)) {
    return { ok: false, error: "problemSlug is invalid" };
  }

  if (!validateCode(b.userCode)) {
    return { ok: false, error: "userCode is required and must be under 50KB" };
  }

  const language = (b.language ?? "javascript") as string;
  if (!validateLanguage(language)) {
    return {
      ok: false,
      error: `language must be one of: ${VALID_LANGUAGES.join(", ")}`,
    };
  }

  return {
    ok: true,
    data: {
      problemSlug: b.problemSlug as string,
      userCode: b.userCode as string,
      language,
      sessionId:
        typeof b.sessionId === "string" && b.sessionId.length > 0
          ? b.sessionId
          : undefined,
    },
  };
}

// feedback request validation
export interface ValidatedFeedbackRequest {
  sessionId: string;
  hintNumber: number;
  helpful: boolean;
}

export function validateFeedbackRequest(
  body: unknown,
): ValidationResult<ValidatedFeedbackRequest> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.sessionId !== "string" || b.sessionId.length === 0) {
    return { ok: false, error: "sessionId is required" };
  }
  if (
    typeof b.hintNumber !== "number" ||
    !Number.isInteger(b.hintNumber) ||
    b.hintNumber < 1 ||
    b.hintNumber > 100
  ) {
    return {
      ok: false,
      error: "hintNumber must be an integer between 1 and 100",
    };
  }

  if (typeof b.helpful !== "boolean") {
    return { ok: false, error: "helpful must be a boolean" };
  }

  return {
    ok: true,
    data: {
      sessionId: b.sessionId,
      hintNumber: b.hintNumber,
      helpful: b.helpful,
    },
  };
}

// librarian request vlaidation
export interface ValidatedConceptRequest {
  question: string;
  userCode: string;
  problemSlug: string;
  language: string;
  sessionId: string | undefined;
}
export function validateConceptRequest(
  body: unknown,
): ValidationResult<ValidatedConceptRequest> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.question !== "string" || b.question.trim().length === 0) {
    return { ok: false, error: "question is required" };
  }

  if (b.question.length > 1000) {
    return { ok: false, error: "question must be under 1000 characters" };
  }

  if (!validateSlug(b.problemSlug)) {
    return { ok: false, error: "problemSlug is invalid" };
  }

  const language = (b.language ?? "javascript") as string;
  if (!validateLanguage(language)) {
    return {
      ok: false,
      error: `language must be one of: ${VALID_LANGUAGES.join(", ")}`,
    };
  }

  return {
    ok: true,
    data: {
      question: b.question.trim(),
      userCode: validateCode(b.userCode) ? (b.userCode as string) : "",
      problemSlug: b.problemSlug as string,
      language,
      sessionId:
        typeof b.sessionId === "string" && b.sessionId.length > 0
          ? b.sessionId
          : undefined,
    },
  };
}
