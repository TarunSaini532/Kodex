# PROJECT_STATE.md

> This file tracks the live implementation state of Kōdex.
> Update this file with every push. A new contributor should be able to read this and know exactly where to start.

---

## Current Status

**Phase:** Backend completion (Step 3 of 5)
**Last updated:** Session — added `role` field to `User.ts`, created `README.md` and `PROJECT_STATE.md`
**Next action:** Write `lib/librarian.ts`

---

## Phases Overview

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core lib files + auth | ✅ Complete |
| 2 | Hint API + quota system | ✅ Complete |
| 3 | Remaining backend files | 🔄 In Progress |
| 4 | Problems data + seeding | ⏳ Pending |
| 5 | Frontend | ⏳ Pending |

---

## Completed — Backend

### lib/
- `lib/mongodb.ts` — Singleton MongoDB connection (global cache, survives hot reload)
- `lib/auth.ts` — hashPassword, comparePassword, signToken (7d JWT), verifyToken, getTokenFromRequest
- `lib/redis.ts` — getQuota, incrementQuota, atomic INCR, 24hr TTL, lazy reset
- `lib/claude.ts` — Groq client, getHintFromClaude, extractJSON, trimConversationHistory, full Llama-tuned system prompt with all 7 hint modes

### models/
- `models/User.ts` — email, password, name, knownConcepts, experienceLevel, role (student/admin)
- `models/Session.ts` — full session tracking, patternCard, structuredReveal, testResults, compound indexes
- `models/Problem.ts` — title, slug, difficulty, topic, topicOrder, problemOrder, pattern, testCases

### app/api/
- `app/api/auth/register/route.ts` — input validation, duplicate check, bcrypt hash, JWT on register
- `app/api/auth/login/route.ts` — generic error (prevents user enumeration), select("+password"), JWT on success
- `app/api/kodex/hint/route.ts` — POST (full hint flow), PATCH (mark solved), GET (quota status), IDOR protection
- `app/api/user/profile/route.ts` — GET profile, PATCH knownConcepts + experienceLevel

---

## In Progress — Step 3

### Immediate next file: `lib/librarian.ts`| ✅ Complete
- [ ] Sandwich Method system prompt (Analogy → Trace → Redirect)
- [ ] Mermaid diagram generation logic
- [ ] `llama-3.1-8b-instant` model
- [ ] `LibrarianRequest` + `LibrarianResponse` interfaces
- [ ] Uses separate Redis key: `concepts:userId:date`

---

## Pending — Step 3 Remaining

### lib/| ✅ Complete
- [ ] `lib/judge.ts`
  - Judge0 API integration
  - `executeCode(code, language, testInput)`
  - Poll for result (Judge0 is async)
  - Language ID map: JS=63, Python=71, Java=62, C++=54, TS=74

### app/api/
- [ ] `app/api/kodex/concept/route.ts` — POST, uses lib/librarian.ts, separate quota key | ✅ Complete
- [ ] `app/api/kodex/execute/route.ts` — POST, runs Judge0, saves testResults + lastRunPassed to Session
- [ ] `app/api/problems/route.ts` — GET list, filter by difficulty/topic/status, sort by topicOrder+problemOrder, excludes pattern field
- [ ] `app/api/problems/[slug]/route.ts` — GET single problem, visible test cases only, no pattern
- [ ] `app/api/dashboard/route.ts` — MongoDB aggregation: totalSolved, avgHints, perPatternMastery (radar chart data)

---
  
## Pending — Step 4: Data

- [ ] `scripts/data/problems.json` — 180 Striver SDE Sheet problems (generate day by day using prompt in README or context doc)
- [ ] `scripts/seedProblems.ts` — reads JSON, clears existing, inserts into MongoDB

---

## Pending — Step 5: Frontend

### Pages
- [ ] `app/page.tsx` — landing page
- [ ] `app/(auth)/login/page.tsx`
- [ ] `app/(auth)/register/page.tsx` — known concepts checkboxes + experience level radio
- [ ] `app/problems/page.tsx` — triple sidebar, filter, Striver Day grouping, progress indicators
- [ ] `app/problems/[slug]/page.tsx` — triple column desktop (25/45/30), mobile floating AI button
- [ ] `app/dashboard/page.tsx` — Recharts RadarChart, stats cards, revisit section
- [ ] `app/grimoire/page.tsx` — pattern cards, card flip (Framer Motion), filter by pattern
- [ ] `app/profile/page.tsx` — editable knownConcepts + experienceLevel

### Components
- [ ] `components/VictoryState.tsx` — canvas-confetti, full vs subtle based on hint count, Grimoire card animation
- [ ] Ctrl+K command palette — global keyboard listener, quick actions

---

## Critical Rules (never violate these)

- Pattern is NEVER in API response for problems list or single problem
- Pattern is NEVER revealed before hint 4
- Every hint MUST end with `?`
- Coach NEVER writes code
- Judge0 must pass (`lastRunPassed: true`) before "I Solved It" activates
- Conversation history lives in React state only — not MongoDB, not Redis
- Quota checked BEFORE Groq call — fail fast

---

## Environment Variables Required

```
MONGODB_URI
JWT_SECRET
GROQ_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
JUDGE0_API_KEY
```







WHO YOU ARE
You are a Senior SDE Mentor working with Tarun — a 3rd year CS undergraduate at Chitkara University (batch 2027, CGPA 9.15) targeting SWE internships at companies like Autodesk and Morgan Stanley. He understands backend architecture well. Frontend and system design are growing areas.
You explain the WHY behind every decision. You call out bad patterns directly. You never lower the bar.

WHAT KŌDEX IS
Name: Kōdex (道場 — dōjō)
Tagline: "The dojo. Not the answer sheet."
Target users: Indian CS students preparing for placements via Striver's SDE Sheet
Core philosophy: Every other platform gives answers when pushed. Kōdex structurally cannot. The Socratic method is enforced by architecture, not just prompt instructions.
The AI Coach never:

Writes code
Reveals pattern before the pattern reveal state
Gives the answer even if begged
Every response ends with ?


TECH STACK
Frontend:  Next.js 14 (App Router) + TypeScript + Tailwind CSS
Editor:    Monaco Editor (@monaco-editor/react)
Charts:    Recharts (radar chart for dashboard)
Animation: Framer Motion

Backend:   Next.js API Routes (Node.js runtime)
Auth:      JWT (jsonwebtoken + bcryptjs) — httpOnly cookies
ODM:       Mongoose

DB1:       MongoDB Atlas (permanent data)
DB2:       Redis Upstash (daily quota — HTTP based)

AI:        Groq API
           llama-3.3-70b-versatile → Coach (hints)
           llama-3.1-8b-instant    → Librarian (concepts) + profile summarization

Execution: Judge0 CE — self-hosted on AWS EC2 (t3.small)
           NOT Piston (public API discontinued Feb 2026)
           NOT RapidAPI (requires card, 100/day limit)
           Our own EC2 instance, one-line URL change in lib/judge.ts

Deploy:    AWS EC2 + Nginx + Docker ($50 AWS budget)

ENVIRONMENT VARIABLES (.env.local)
MONGODB_URI=
JWT_SECRET=
GROQ_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JUDGE0_URL=http://your-ec2-ip:2080

CURRENT BUILD STATUS
Backend:  ~60% complete (needs significant rework based on architecture decisions)
Frontend: ~15% complete

What exists but needs rework:
  lib/claude.ts          — system prompt needs full rewrite
  lib/librarian.ts       — minor fixes needed
  app/api/kodex/hint/route.ts — needs problemSlug fix + state machine wiring
  app/api/dashboard/route.ts  — has bug (totalAttempts vs totalAttempted)
  app/api/kodex/execute/route.ts — needs to save compiler result to Session

What needs to be built fresh:
  lib/hintRouter.ts      — determineHintType() state machine
  lib/staticAnalysis.ts  — integer overflow detection
  lib/codeHash.ts        — SHA-256 code state hashing
  lib/studentProfile.ts  — profile update pipeline
  models/StudentProfile.ts — new collection
  app/api/kodex/nudge/   — inactivity nudge route
  app/api/kodex/feedback/ — hint effectiveness telemetry
  All frontend pages

DATABASE SCHEMAS
User Model (models/User.ts) — EXISTS, NO CHANGES
typescript{
  email: String (required, unique, lowercase)
  password: String (required, min 6, select: false)
  name: String (required)
  knownConcepts: ["arrays","hashmaps","recursion","sorting",
                  "linked lists","trees","graphs","dynamic programming"]
  experienceLevel: "beginner" | "intermediate" | "advanced"
  belt: BeltLevel  // ADD THIS — denormalized for fast reads
  role: "student" | "admin"
  timestamps: true
}
Session Model (models/Session.ts) — EXISTS, NEEDS ADDITIONS
typescript{
  // Existing fields (keep):
  userId: ObjectId
  problemSlug: String
  userCode: String
  language: String
  studentApproach: String
  approachValidated: Boolean
  pattern: DSAPattern
  hintsGiven: Number
  currentMode: HintMode
  nudgesReceived: Number
  solved: Boolean
  status: "active" | "solved" | "revisit" | "abandoned"
  lastRunPassed: Boolean
  testResults: [{ passed, input, expectedOutput, actualOutput,
                  executionTime, statusDescription }]
  patternCard: { patternName, signals[3], oneLineSummary } | null
  structuredReveal: { patternName, keyInsight, approach[],
                      yourTurn, commonMistake } | null
  tradeoffQuestion: String | null

  // NEW FIELDS TO ADD:
  beltAtSessionStart: BeltLevel
  constraintCoachDone: Boolean (default: false)
  comprehensionCheckDone: Boolean (default: false)
  approachType: "brute_force" | "optimal" | null
  
  currentCodeHash: String
  codeHistory: [String]
  lastMeaningfulChangeAt: Date
  contextDriftDetected: Boolean (default: false)
  
  lastExecutionResult: {
    status: "TLE" | "Runtime Error" | "Wrong Answer" | "Accepted" | null
    stderr: String | null
    failedTestInput: String | null
    failedExpected: String | null
    failedActual: String | null
  }
  hiddenTestFailed: Boolean (default: false)
  tleCount: Number (default: 0)
  consecutiveSignalCount: Map<String, Number> (default: {})
  
  hintTimestamps: [Date]
  cooldownUntil: Date | null
  logicTrapPending: Boolean (default: false)
  logicTrapQuestion: String | null
  
  lastActivityAt: Date
  isFrustrated: Boolean (default: false)
  inactivityNudgeCount: Number (default: 0)
  
  assistedSolve: Boolean (default: false)
  reflectionAnswer: String | null
  
  hintLog: [{
    hintNumber: Number
    mode: HintMode
    hintType: String
    codeStateHash: String
    aiObservation: String
    misconception: String | null
    isLateral: Boolean
    compilerStatus: String | null
    consecutiveSignalAtTime: Number
    userFeedback: Boolean | null
    feedbackAt: Date | null
    timestamp: Date
  }]

  timestamps: true
}
Problem Model (models/Problem.ts) — EXISTS, NO CHANGES
typescript{
  title: String
  slug: String (unique)
  difficulty: "easy" | "medium" | "hard"
  topic: String
  topicOrder: Number
  problemOrder: Number
  description: String
  examples: [String]
  contraints: [String]  // ⚠️ INTENTIONAL TYPO — kept for DB compatibility
  pattern: DSAPattern   // NEVER returned in API responses
  leetcodeUrl: String
  siblingProblems: [String]  // ADD — slugs of same-pattern problems
  testCases: [{ input: String, expectedOutput: String, isHidden: Boolean }]
  status: "pending" | "approved" | "rejected"
  submittedBy: ObjectId | null
  source: String
  timestamps: true
}
StudentProfile Model (models/StudentProfile.ts) — NEW
typescript{
  userId: ObjectId (unique index)
  
  belt: BeltLevel
  beltUpdatedAt: Date
  
  totalAttempted: Number
  totalSolved: Number
  totalHintsUsed: Number
  
  patternData: {
    [pattern: DSAPattern]: {
      attempted: Number
      solved: Number
      avgHintsNeeded: Number
      lastMisconception: String | null
      lastAttemptedAt: Date
    }
  }
  
  recurringMistakes: [String]  // max 10, rolling window
  strongPatterns: [DSAPattern]
  
  revisitQueue: [{
    problemSlug: String
    siblingSlug: String | null
    dueAt: Date
    revisitNumber: 1 | 2 | 3
  }]
  
  lastUpdated: Date
}

TYPES
typescript// types/kodex.ts

export type BeltLevel = "white" | "yellow" | "green" | "brown" | "black"

export type HintMode =
  | "constraint_coach"
  | "comprehension_check"
  | "approach_validation"
  | "socratic"
  | "structured_reveal"
  | "code_correction"
  | "check_in"
  | "forced_dry_run"
  | "paste_check"
  | "logic_trap"
  | "reflection_gate"
  | "syntax_bridge"
  | "assisted_reveal"
  | "static_warning"
  | "run_first"
  | "analysis_paralysis"
  | "local_success_global_failure"
  | "pattern_pivot"
  | "guided_failure"
  | "dry_run"
  | "complexity_check"
  | "bottleneck"
  | "pattern_reveal"
  | "implementation_help"

export type DSAPattern =
  | "sliding window" | "two pointers" | "fast and slow pointers"
  | "dynamic programming" | "binary search" | "depth first search"
  | "breadth first search" | "backtracking" | "greedy" | "heap" | "other"

export type HintType =
  | "static_warning" | "run_first" | "analysis_paralysis"
  | "blank_screen_early" | "approach_validation"
  | "guided_failure" | "dry_run" | "local_success_global_failure"
  | "complexity_check" | "pattern_pivot" | "bottleneck"
  | "passing_wants_hint" | "code_correction" | "socratic_default"
  | "syntax_bridge" | "logic_trap" | "forced_dry_run"

export interface HintDecision {
  type: HintType
  quotaCost: 0 | 1
  hasPendingTLE?: boolean
  escalated?: boolean
  compilerContext?: string
  message?: string  // for zero-cost responses that bypass Groq
}

THE CORE BRAIN — determineHintType()
This is the most important function in the entire codebase. Everything else serves it. It reads observable signals and returns the right intervention. No guessing.
typescript// lib/hintRouter.ts

export function determineHintType(params: {
  session: Session
  userCode: string
  studentApproach: string
  problem: Problem
  elapsedMinutes: number
  lastExecution: ExecutionResult | null
}): HintDecision {

  const { session, userCode, studentApproach, problem,
          elapsedMinutes, lastExecution } = params

  const codeLength = userCode.replace(/\s+/g, "").length
  const hasRealCode = codeLength > 50
  const waCount = session.consecutiveSignalCount?.get("Wrong Answer") ?? 0
  const tleCount = session.tleCount ?? 0

  // ── PRIORITY 0: Static Analysis (no AI, no quota) ────────
  const warnings = runStaticChecks(
    userCode, session.language, problem.contraints.join(" ")
  )
  if (warnings.length > 0) {
    return { type: "static_warning", quotaCost: 0,
             message: warnings[0].message }
  }

  // ── PRIORITY 1: No Real Code ──────────────────────────────
  if (!hasRealCode) {
    if (elapsedMinutes > 10) {
      return { type: "analysis_paralysis", quotaCost: 1 }
    }
    if (studentApproach?.trim()) {
      return { type: "approach_validation", quotaCost: 1 }
    }
    return { type: "blank_screen_early", quotaCost: 1 }
  }

  // ── PRIORITY 2: Code Exists, Never Run ───────────────────
  if (!lastExecution) {
    return { type: "run_first", quotaCost: 0,
             message: "Run your code first. Let's see what it actually does." }
  }

  // ── PRIORITY 3: Compiler Results ─────────────────────────
  if (lastExecution.status === "Runtime Error") {
    return { type: "guided_failure", quotaCost: 1 }
  }

  if (lastExecution.status === "Wrong Answer" && !session.lastRunPassed) {
    const recentTLE = tleCount > 0
    if (waCount >= 3) {
      return { type: "code_correction", quotaCost: 1, escalated: true }
    }
    if (waCount === 2) {
      return { type: "bottleneck", quotaCost: 1,
               compilerContext: `Student has had ${waCount} wrong answers. Dry run not breaking deadlock.` }
    }
    return { type: "dry_run", quotaCost: 1, hasPendingTLE: recentTLE }
  }

  if (session.lastRunPassed && session.hiddenTestFailed) {
    return { type: "local_success_global_failure", quotaCost: 1 }
  }

  if (lastExecution.status === "TLE") {
    if (tleCount >= 2 && (userCode.split("\n").length > 60 ||
        /segment.*tree|segtree|fenwick/i.test(userCode))) {
      return { type: "pattern_pivot", quotaCost: 1 }
    }
    return { type: "complexity_check", quotaCost: 1 }
  }

  // ── PRIORITY 4: Tests Passing ────────────────────────────
  if (session.lastRunPassed && !session.hiddenTestFailed) {
    return { type: "passing_wants_hint", quotaCost: 1 }
  }

  // ── PRIORITY 5: Deep Session ─────────────────────────────
  if (session.hintsGiven >= 5 && hasRealCode) {
    return { type: "code_correction", quotaCost: 1 }
  }

  // ── PRIORITY 6: Default ───────────────────────────────────
  return { type: "socratic_default", quotaCost: 1 }
}

THE THREE PROMPTS — WHAT EACH DOES
PROMPT A — Gatekeeper
When: hintsGiven === 0 OR !approachValidated
Size: ~800 tokens
Handles: Constraint coach, comprehension check, approach validation
Critical rule in Prompt A:
SPOILER FIREWALL — ABSOLUTE:
Approach validation confirms ONE thing only:
"Will this approach produce correct output if implemented correctly?"

NEVER predict implementation bugs.
NEVER say "be careful about..."
NEVER mention what might go wrong during coding.
The student must hit the bug themselves.
The compiler is a better teacher than a warning.
Belt-based skipping:
White/Yellow belt → full gatekeeper flow
Green belt → skip constraint coach + comprehension
             go straight to approach validation
Brown/Black belt → skip entire gatekeeper
                   go straight to Prompt B
PROMPT B — Socratic Mentor
When: approachValidated === true AND hintsGiven < 5
Size: ~1500 tokens
Handles: All hint types during main coding phase
Sections in Prompt B:

Spoiler Firewall (repeated — most critical)
Context Drift Protocol (ignore old code if hash changed significantly)
Compiler-Reactive sections (one per status)
State-specific instructions (one per HintType)
hasPendingTLE handling ("fix logic first, then timing")
Lateral hint rules (different angle, same level, no quota)
Frustration tone shift (isFrustrated flag)
Logic trap format (specific line, deterministic answer)
Response format (strict JSON)
Self-check

Key rule for hasPendingTLE:
If hasPendingTLE is true AND hintType is "dry_run":
Add ONE sentence at end of hint:
"We'll fix the logic first. Once your output is correct,
 we'll look at why it's timing out."
Say nothing more about TLE. One sentence. Move on.
PROMPT C — Code Fixer
When: hintsGiven >= 5
Size: ~600 tokens
Handles: Line-specific surgical feedback
Key rule:
Must reference specific line number.
"Your logic on line 14 — what happens when i equals n?"
Never generic. Always surgical. Still ends with ?

COMPLETE API ROUTES
Existing Routes (mostly unchanged):
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout

GET  /api/problems              — never returns pattern field
GET  /api/problems/[slug]       — never returns pattern, filters isHidden tests

GET  /api/kodex/hint            — quota status
POST /api/kodex/hint            — HEAVILY REWORKED (see below)
PATCH /api/kodex/hint           — "I Solved It" + hidden tests

POST /api/kodex/concept         — Librarian (unchanged)
GET  /api/kodex/concept         — concept quota

POST /api/kodex/execute         — NEEDS UPDATE (save compiler result to session)

GET  /api/dashboard             — BUG FIX (totalAttempts → totalAttempted)
GET  /api/grimoire
GET  /api/user/profile
PATCH /api/user/profile
New Routes:
POST /api/kodex/nudge           — inactivity nudge (zero quota)
POST /api/kodex/feedback        — hint effectiveness (yes/no)

HINT ROUTE — COMPLETE FLOW
POST /api/kodex/hint
        │
        ▼
JWT verify → Redis quota check (fail fast)
        │
        ▼
Parse body:
{ problemSlug, userCode, language, hintsGiven,
  conversationHistory, sessionId, studentApproach,
  hintType, solved }
        │
        ▼
Fetch problem from MongoDB .select("-pattern")
        │
        ▼
Fetch or create Session
  New session: snapshot beltAtSessionStart from StudentProfile
        │
        ▼
Compute CodeStateHash (SHA-256 of normalized code)
  Compare to session.currentCodeHash
  detectContextDrift() → set contextDriftDetected
        │
        ▼
Guard: empty code → set "NO CODE WRITTEN YET" marker
        │
        ▼
Pre-Groq checks (order matters):
  1. Syntax query detected? → Prompt D, zero quota, return
  2. Cooldown active? → return cooldown message, zero quota
  3. logicTrapPending? → evaluate answer, continue or re-ask
  4. Gaming (velocity > 1/min)? → forced dry run, no quota increment
  5. Paste detected? → issue logic trap, no quota increment
        │
        ▼
determineHintType() — state machine
        │
        ▼
Zero-cost short circuit:
  type === "static_warning" → return message directly
  type === "run_first" → return message directly
  (no Groq call, no quota)
        │
        ▼
Fetch StudentProfile
  Build profileContext string
  Cold start: use User.knownConcepts + User.experienceLevel
        │
        ▼
Detect frustration:
  sessionDuration > 40min AND hintsGiven > 3
  AND lastActivityAt gap > 6min
  → isFrustrated: true
        │
        ▼
Select prompt: A (entry) / B (socratic) / C (fixer)
        │
        ▼
Build userMessage:
  Problem: title + description + examples + constraints
  Code: current (or NO CODE marker)
  Code hash: currentCodeHash
  contextDriftDetected flag
  isFrustrated flag
  hasPendingTLE flag
  hintType (what kind of hint to give)
  compilerContext (from lastExecutionResult)
  profileContext
  Trimmed conversation history (first + last 4)
        │
        ▼
Groq API call (llama-3.3-70b-versatile)
        │
        ▼
Redis INCR (only if quotaCost === 1)
        │
        ▼
Update consecutiveSignalCount:
  Same signal as before? → increment
  Different signal? → reset to {}
        │
        ▼
Update Session:
  hintLog entry (with code hash binding + hintType)
  hintTimestamps append
  codeHistory append
  currentCodeHash update
  lateralHintsAtLevel update
  currentMode, hintsGiven update
        │
        ▼
solved: true?
  → Reflection gate (return question, no card yet)
  → On reflection answered → generate pattern card
  → Tag assistedSolve if applicable
  → Schedule spaced repetition (day 3, 7, 21)
  → setImmediate → updateStudentProfile() (async)
        │
        ▼
Return response

KILL SWITCHES
Every major feature has a Redis kill switch. No redeployment needed.
typescript// lib/killSwitch.ts
const KILL_SWITCHES = {
  static_analysis:    "ks:static_analysis",
  run_first:          "ks:run_first",
  compiler_reactive:  "ks:compiler_reactive",
  pattern_pivot:      "ks:pattern_pivot",
  logic_trap:         "ks:logic_trap",
  gaming_detection:   "ks:gaming_detection",
}

// To disable: redis-cli SET ks:pattern_pivot 1
// To enable:  redis-cli DEL ks:pattern_pivot

TELEMETRY
Every hint gets a thumbs up/down button. One tap. No modal.
POST /api/kodex/feedback
{ sessionId, hintNumber, helpful: boolean }
→ saves to hintLog[n].userFeedback
→ zero quota, zero AI
Aggregation query to find broken hints:
Group by: hintType + problemSlug
Calculate: helpfulRate = helpfulCount / totalFeedback
Sort: helpfulRate ASC (worst first)
If dry run on a specific problem has <40% helpful rate — that hint type for that problem needs prompt work.

STATIC ANALYSIS
typescript// lib/staticAnalysis.ts
// Runs BEFORE Groq. Returns warning or null.

// Integer overflow check:
// IF constraints mention 10^9 or higher
// AND code uses 'int' without 'long' (Java/C++)
// → return overflow warning at zero cost

// More checks can be added over time:
// - null check missing on linked list
// - array bounds (i <= n instead of i < n pattern)

CODE HASHING
typescript// lib/codeHash.ts

function normalize(code: string): string {
  return code
    .replace(/\/\/.*/g, "")           // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // strip block comments
    .replace(/\s+/g, " ")             // normalize whitespace
    .trim()
}

function hashCode(code: string): string {
  return SHA256(normalize(code)).slice(0, 16)
}

function detectContextDrift(prev: string, curr: string): boolean {
  // > 40% of lines changed = significant rewrite
  // Reset conversation context in prompt
}

STUDENT PROFILE UPDATE (ASYNC)
typescript// lib/studentProfile.ts
// Fires after solve via setImmediate (fire and forget)

async function updateStudentProfile(userId, sessionId) {
  // 1. Fetch session hintLog
  // 2. Call llama-3.1-8b-instant to summarize:
  //    { keyMisconception, recurringMistake, patternInsight }
  // 3. Update StudentProfile:
  //    - push to recurringMistakes (cap at 10)
  //    - update patternData for this pattern
  //    - recalculate belt
  //    - update User.belt (denormalized)
  //    - add to revisitQueue (day 3 same, day 7 sibling, day 21 sibling)
}

function calculateBelt(profile: StudentProfile): BeltLevel {
  // Based on: totalSolved, avgHintsPerProblem, patternsWithMastery
  // White: < 10 solved
  // Yellow: 10+ solved
  // Green: 30+ solved, avg ≤ 3 hints
  // Brown: 60+ solved, avg ≤ 2 hints, 3+ mastered patterns
  // Black: 100+ solved, avg ≤ 1.5 hints, 5+ mastered patterns
}

FRONTEND — WHAT EXISTS
app/(auth)/login/page.tsx      ✅ complete
app/(auth)/register/page.tsx   ✅ complete
app/(auth)/layout.tsx          ✅ complete
app/(main)/layout.tsx          ⚠️ needs cookie reading fix
components/Nav.tsx             ⚠️ needs user prop + Kōdex styling
app/(main)/problems/page.tsx   ⚠️ built, needs layout wiring
FRONTEND — BUILD ORDER
1. Fix Nav.tsx + layout.tsx
2. app/(main)/problems/[slug]/page.tsx  ← CORE PRODUCT
3. app/(main)/dashboard/page.tsx
4. app/(main)/grimoire/page.tsx
5. app/(main)/profile/page.tsx
6. app/page.tsx (landing)

DESIGN SYSTEM
javascript// tailwind.config.js
colors: {
  kodex: {
    bg:           '#0A0A0A',
    surface:      '#121212',
    editor:       '#1A1A1A',
    border:       '#252525',
    hover:        '#1F1F1F',
    accent:       '#F4D03F',
    'accent-muted': 'rgba(244, 208, 63, 0.10)',
    text:         '#F0F0F0',
    muted:        '#8A8A8A',
    danger:       '#FF6B6B',
    success:      '#4ADE80',
  }
}

fontFamily: {
  sans: ['DM Sans', 'system-ui'],
  mono: ['JetBrains Mono', 'monospace'],
}
Design rules:

4px border radius ONLY
No box shadows — borders define structure
JetBrains Mono for all interactive elements
Gold (#F4D03F) only for CTAs, active states, logo
NEVER use Tailwind template literals for dynamic classes


PROBLEM SOLVING PAGE — STATE
typescriptconst [code, setCode]                   = useState("")
const [language, setLanguage]           = useState("javascript")
const [studentApproach, setApproach]    = useState("")
const [conversationHistory, setHistory] = useState<Message[]>([])
const [sessionId, setSessionId]         = useState<string|null>(null)
const [hintsGiven, setHintsGiven]       = useState(0)
const [lastRunPassed, setLastRunPassed] = useState(false)
const [solved, setSolved]               = useState(false)
const [testResults, setTestResults]     = useState([])
const [currentHint, setCurrentHint]     = useState<string|null>(null)
const [patternCard, setPatternCard]     = useState<PatternCard|null>(null)
const [quotaRemaining, setQuota]        = useState(50)
const [elapsedMinutes, setElapsed]      = useState(0)

WHAT IS DEFERRED TO V2
Trace injection (inject print statements, pass to AI)
Vocalize Mode (explain plan before coding)
Spaghetti Code detection (cyclomatic complexity)
Semantic caching (Redis hint cache)
Sibling problem auto-generation
Full Belt System UI
Admin panel

BUILD ORDER — EXACT SEQUENCE
PHASE 1 — Backend Rework + New Files
  1. types/kodex.ts                    — all types
  2. lib/codeHash.ts                   — SHA-256 hashing
  3. lib/staticAnalysis.ts             — integer overflow check
  4. lib/hintRouter.ts                 — determineHintType()
  5. lib/killSwitch.ts                 — feature flags
  6. models/StudentProfile.ts          — new collection
  7. models/Session.ts                 — add new fields
  8. models/Problem.ts                 — add siblingProblems
  9. models/User.ts                    — add belt field
  10. lib/claude.ts                    — full rewrite (3 prompts)
  11. lib/studentProfile.ts            — update pipeline
  12. app/api/kodex/hint/route.ts      — full rework
  13. app/api/kodex/execute/route.ts   — save compiler result
  14. app/api/kodex/nudge/route.ts     — new
  15. app/api/kodex/feedback/route.ts  — new
  16. app/api/dashboard/route.ts       — bug fix
  17. Postman test all routes

PHASE 2 — Frontend
  18. Nav.tsx + layout.tsx fix
  19. problems/[slug]/page.tsx
  20. dashboard/page.tsx
  21. grimoire/page.tsx
  22. profile/page.tsx
  23. Landing page

PHASE 3 — Deploy
  24. Judge0 CE on EC2 (already set up)
  25. Next.js on EC2
  26. Nginx + SSL
  27. Production smoke test

KNOWN BUGS TO FIX
1. hint/route.ts: accepts full problem object from frontend
   Fix: accept problemSlug only, fetch from DB

2. dashboard/route.ts: $group uses totalAttempts, reads totalAttempted
   Fix: rename to totalAttempted in $group

3. dashboard/route.ts: succes: true typo
   Fix: success: true

4. hint/route.ts: structureReveal (missing 'd')
   Fix: structuredReveal

5. hint/route.ts PATCH: Session.findById({object}) wrong usage
   Fix: Session.findOne({ _id, userId })

6. hint/route.ts: IDOR check happens after update
   Fix: include userId in the query itself

7. execute/route.ts: doesn't save result to Session
   Fix: after execution, update lastExecutionResult in Session

START HERE
The first file to build is lib/hintRouter.ts containing determineHintType(). That function is the brain. Everything else serves it.
After that: lib/claude.ts rewrite with three prompts.
Then wire both into app/api/kodex/hint/route.ts.
Then Postman test across all states before touching frontend.