export interface StaticWarning {
  code: string;
  message: string;
}

export function runStaticChecks(
  userCode: string,
  language: string,
  constraintText: string,
): StaticWarning[] {
  const warnings: StaticWarning[] = [];
  const checks = [
    checkIntegerOverflow,
    checkArrayBoundPattern,
    checkNullDereferencePattern,
  ];

  for (const check of checks) {
    const warning = check(userCode, language, constraintText);
    if (warning) warnings.push(warning);
  }
  return warnings;
}

const OVERFLOW_CONSTRAINT_PATTERN =
  /10\s*[\^*]\s*[89]|10[89]|1[0-9]{8,}|1_000_000_000/;

const INT_DECL_PATTERN = /(?<![A-Za-z])\bint\b(?!\s*\*?\s*\[)/;

function checkIntegerOverflow(
  userCode: string,
  language: string,
  constraintText: string,
): StaticWarning | null {
  const affectedLanguages = ["java", "c", "cpp", "c++"];
  if (!affectedLanguages.includes(language.toLowerCase())) return null;

  const hasLargeConstraint = OVERFLOW_CONSTRAINT_PATTERN.test(constraintText);
  if (!hasLargeConstraint) return null;

  const strippedCode = userCode
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''");

  const hasLong = /\blong\b/.test(strippedCode);
  if (hasLong) return null;
  const hasIntDecl = INT_DECL_PATTERN.test(strippedCode);
  if (!hasIntDecl) return null;
  return {
    code: "INT_OVERFLOW",
    message:
      "Your constraints mention values up to 10⁹. " +
      "An `int` holds ~2.1 × 10⁹ — multiplication of two large values will overflow silently. " +
      "Does your solution need `long` anywhere?",
  };
}

function checkArrayBoundPattern(
  userCode: string,
  language: string,
  constraintText: string,
): StaticWarning | null {
  const affectedLanguages = ["java", "c", "cpp", "c++"];
  if (!affectedLanguages.includes(language.toLowerCase())) return null;
  const leqLoopPattern = /for\s*\([^)]*\bi\s*<=\s*\w+[^)]*\)/;
  const arrAccessPattern = /\w+\s*\[\s*i\s*\]/;
  const hasLeqLoop = leqLoopPattern.test(userCode);
  const hasArrAccess = arrAccessPattern.test(userCode);
  if (!hasLeqLoop || !hasArrAccess) return null;

  return {
    code: "ARRAY_BOUNDS_SUSPECT",
    message:
      "I see a loop with `i <= n` while also indexing into an array with `arr[i]`. " +
      "If your array has `n` elements, valid indices are `0` to `n-1`. " +
      "Is `i <= n` intentional here?",
  };
}

function checkNullDereferencePattern(
  userCode: string,
  language: string,
  constraintText: string,
): StaticWarning | null {
  const affectedLanguages = ["java", "c", "cpp", "c++"];
  if (!affectedLanguages.includes(language.toLowerCase())) return null;

  const chainedNextPattern = /\.next\.\w+/;
  if (!chainedNextPattern.test(userCode)) return null;

  const hasNullCheck = /!=\s*null|null\s*!=|!=\s*nullptr|nullptr\s*!=/.test(
    userCode,
  );
  if (hasNullCheck) return null;
  return {
    code: "NULL_DEREF_SUSPECT",
    message:
      "You're accessing `.next.something` — if `.next` is `null` at runtime, " +
      "that's an immediate crash. Is there a null check before that access?",
  };
}
