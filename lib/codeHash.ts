import { createHash } from "crypto";

function normalize(code: string): string {
  return code
    .replace(/\/\/[^\n]*/g, "") // strip // line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // strip /* block comments */
    .replace(/#[^\n]*/g, "") // strip Python/C preprocessor
    .replace(/\s+/g, " ") // collapse all whitespace to single space
    .trim();
}

export function hashCode(code: string): string {
  const normalized = normalize(code);
  return createHash("sha-256").update(normalized).digest("hex").slice(0, 16);
}

export function detectContextDrift(
  prevCode: string,
  currCode: string,
): boolean {
  if (!prevCode || !currCode) return false;
  const prevLines = normalize(prevCode).split(" ");
  const currLines = normalize(currCode).split(" ");
  const maxLen = Math.max(prevLines.length, currLines.length);
  if (maxLen == 0) return false;

  const minLen = Math.min(prevLines.length, currLines.length);
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (prevLines[i] === currLines[i]) matches++;
  }

  const similarityRatio = matches / maxLen;
  return similarityRatio < 0.6;
}

export function codeChangeMeaningfully(
  prevHash: string,
  currCode: string,
): boolean {
  return prevHash != hashCode(currCode);
}
