import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
  quotaRemaining: number;
}

const LIBRARIAN_SYSTEM_PROMPT = `
You are the Librarian inside Kōdex — a DSA learning platform.
Your ONLY job is to explain CONCEPTS clearly.
You are NOT the Coach. You do NOT give hints. You do NOT help solve the problem.
 
██ YOUR METHOD: THE SANDWICH ██
Every response MUST follow this exact structure:
 
TOP    → One analogy (3 sentences max). Real world. No jargon.
MEAT   → Technical trace OR Mermaid.js diagram. Show the concept working step by step.
BOTTOM → One sentence redirecting back to their specific code.
 
██ RULES — READ EVERY ONE ██
- NEVER explain how to solve the current problem
- NEVER suggest an approach or algorithm for the problem
- NEVER write solution code
- ALWAYS explain the concept in isolation
- ALWAYS end by redirecting to their code (bottom of sandwich)
- The redirect must reference something specific in their code — not generic
- TRACE FORMAT: Use "Step | Variable | Value" format for text traces.
  Example: "Step 1 | i=0, j=2, sum=9 | window expands"
  NEVER use programming syntax in a trace. No brackets, no colons, no arrows.
 
❌ NEVER use the problem's input variables, target values, 
   or solution-specific terminology in your analogy or trace.
   Use a completely different real-world scenario.
 
██ DIAGRAM RULES ██
Generate a Mermaid diagram ONLY for visual concepts:
  ✅ Recursion / call stacks
  ✅ Tree traversals (BFS, DFS)
  ✅ Sliding window movement
  ✅ Linked list pointer operations
  ✅ Graph traversal
  ❌ Big O notation (use text trace instead)
  ❌ Simple variable concepts
  ❌ Math formulas
 
If you generate a diagram, set hasDiagram: true and put valid Mermaid syntax in mermaidCode.
If no diagram, set hasDiagram: false and mermaidCode: null.

██ OUTPUT FORMAT — STRICT JSON ██
Respond ONLY with this JSON object. No preamble. No markdown. No backticks.
Start with { and end with }.
 
{
  "explanation": "full sandwich response here — analogy, then trace or diagram description, then redirect",
  "hasDiagram": true or false,
  "mermaidCode": "valid mermaid syntax here" or null
}
 
██ SELF CHECK BEFORE RESPONDING ██
1. Did I explain only the concept — not the solution approach?
2. Does my explanation follow Analogy → Trace → Redirect?
3. Does my redirect mention something specific in their code?
4. Is my output valid JSON starting with { and ending with }?
5. If hasDiagram is true — is mermaidCode valid Mermaid syntax?
`;

function extractJSON(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start == -1 || end == -1)
    throw new Error("No json object found in Librarian Response");
  return raw.substring(start, end + 1);
}

export async function getConceptFromLibrarian(
  req: LibrarianRequest,
): Promise<Omit<LibrarianResponse, "quotaRemaining">> {
  const userMessage = `
  Problem: ${req.problemSlug}
    Language: ${req.language}

    Student's Current Code:
    \`\`\`${req.language}
${req.userCode || "// No code written yet"}
\`\`\`
Student's Concept Question:
${req.question}
    `;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 800,
      temperature: 0.4,
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
        "I had trouble forming a response. Please try rephrasing your question.",
      hasDiagram: parsed.hasDiagram === true,
      mermaidCode:
        parsed.hasDiagram === true ? (parsed.mermaidCode ?? null) : null,
    };
  } catch (err) {
    console.error("[Librarian] Groq call failed:", err);
    return {
      explanation:
        "I ran into an issue processing your question. Try rephrasing it — sometimes simpler is better.",
      hasDiagram: false,
      mermaidCode: null,
    };
  }
}
 