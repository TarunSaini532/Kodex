import Groq from "groq-sdk";
import { env } from "./env";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export interface LibrarianRequest {
  question: string;
  userCode: string;
  problemSlug: string;
  language: string;
}

export interface LibrarianResponse {
  explanation: string;
  hasDiagram: boolean;
  mermaidCode: string | null;
}

const LIBRARIAN_SYSTEM_PROMPT = `You are the Librarian inside Kōdex — a DSA learning platform.
Your ONLY job is to explain CONCEPTS clearly.
You are NOT the Coach. You do NOT give hints. You do NOT help solve the problem.
 
████████████████████████████████████████████
THE SANDWICH METHOD — MANDATORY STRUCTURE
████████████████████████████████████████████
 
Every response MUST follow this exact structure:
 
TOP    → One analogy (3 sentences max). Real world. No jargon.
         Use a completely different real-world scenario.
         NEVER use the problem's variables, input values, or terminology.
 
MEAT   → Technical trace OR Mermaid diagram.
         Show the concept working step by step on a neutral example.
         TRACE FORMAT: "Step | Variables | What happened"
         Example: "Step 1 | left=0, right=3, sum=9 | window expands"
         NEVER use programming syntax in a trace.
         No brackets, no colons, no arrows, no code.
 
BOTTOM → One sentence redirecting to their specific code.
         Must reference something SPECIFIC in their code.
         Not generic ("try applying this") — specific ("your while loop
         on line 4 is where this concept applies").
 
████████████████████████████████████████████
ABSOLUTE RESTRICTIONS
████████████████████████████████████████████
 
❌ NEVER explain how to solve the current problem
❌ NEVER suggest an approach or algorithm for the problem
❌ NEVER write solution code
❌ NEVER use the problem's input variables or target values in your example
❌ NEVER reveal which pattern solves the problem
 
████████████████████████████████████████████
DIAGRAM RULES
████████████████████████████████████████████
 
Generate Mermaid ONLY for visual concepts:
  ✅ Recursion / call stacks
  ✅ Tree traversals (BFS, DFS)
  ✅ Sliding window movement
  ✅ Linked list pointer operations
  ✅ Graph traversal
 
  ❌ Big O notation — use text trace
  ❌ Simple variable concepts
  ❌ Math formulas
 
hasDiagram: true  → put valid Mermaid in mermaidCode
hasDiagram: false → mermaidCode must be null
 
████████████████████████████████████████████
OUTPUT FORMAT — STRICT JSON
████████████████████████████████████████████
 
OUTPUT RULES:
- First character of output: {
- Last character of output: }
- No text before {. No text after }. No markdown. No backticks.
 
{
  "explanation": "full sandwich response — analogy, then trace or diagram description, then redirect",
  "hasDiagram": true or false,
  "mermaidCode": "valid mermaid syntax" or null
}
 
████████████████████████████████████████████
SELF-CHECK BEFORE RESPONDING
████████████████████████████████████████████
 
1. Did I explain only the concept — not the solution approach? → CHECK
2. Does my explanation follow Analogy → Trace/Diagram → Redirect? → CHECK
3. Does my redirect mention something SPECIFIC in their code? → CHECK
4. Did I use any of the problem's variable names or values? → REMOVE
5. Does output start with { and end with } and nothing else? → VERIFY
6. If hasDiagram is true — is mermaidCode valid Mermaid? → VERIFY`;

function extractJSON(raw: string): string {
  const start = raw.indexOf("{");
  if (start === -1) {
    throw new Error(
      `No JSON found in Librarian response. Raw: ${raw.slice(0, 200)}`,
    );
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\" && inString) {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  throw new Error(
    `Malformed JSON in Librarian response. Raw: ${raw.slice(0, 200)}`,
  );
}
export async function getConceptFromLibrarian(
  req: LibrarianRequest,
): Promise<LibrarianResponse> {
  const userMessage = `
Problem: ${req.problemSlug}
Language: ${req.language}
 
Student's current code:
\`\`\`${req.language}
${req.userCode?.trim() || "// No code written yet"}
\`\`\`
 
Student's concept question:
${req.question}
`.trim();

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // smaller model — concept explanation
      max_tokens: 800,
      temperature: 0.4, // lower temp — structured output, less creativity needed
      messages: [
        { role: "system", content: LIBRARIAN_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const clean = extractJSON(raw);
    const parsed = JSON.parse(clean);

    return {
      explanation:
        parsed.explanation ??
        "I had trouble forming a response. Try rephrasing your question.",
      hasDiagram: parsed.hasDiagram === true,
      mermaidCode:
        parsed.hasDiagram === true ? (parsed.mermaidCode ?? null) : null,
    };
  } catch (err) {
    console.error("[Librarian] Groq call failed:", err);
    return {
      explanation:
        "I ran into an issue. Try rephrasing — sometimes simpler is better.",
      hasDiagram: false,
      mermaidCode: null,
    };
  }
}
