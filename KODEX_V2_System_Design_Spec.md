Kōdex — The Complete Story
How We Got Here

Where We Started
Kōdex began as a straightforward idea. Build a DSA platform that uses AI to give hints instead of answers. The initial architecture was simple:
Student asks for hint
→ AI gives hint 1
→ Student asks again  
→ AI gives hint 2
→ Repeat until solved
Seven numbered hints in a fixed sequence. Linear. Clean on paper.
The system prompt was already well-written. Strong restrictions. Never write code. Every response ends with a question mark. The Socratic philosophy was correct from day one.
But when we started stress-testing it, the cracks appeared immediately.

Problem 1 — The AI Had No Eyes
The first real test revealed the root cause of weak hints. When you sent a hint request with problem: problemObject from the frontend, JavaScript serialized it as [object Object]. The AI was coaching a student on a problem it had never actually read.
It was hallucinating hints about nothing.
Fix: Frontend sends only problemSlug. Backend fetches the full problem from MongoDB — title, description, examples, constraints. Ground truth always comes from the database, never from the frontend.
This single fix was the difference between the AI giving generic questions and actually coaching on the specific problem.

Problem 2 — The Hint Progression Was Linear, Students Are Not
The original 7-level sequence assumed students get stuck in order:
Approach → Complexity → Dry Run → Bottleneck → Pattern → Implement → Fix
Reality from actual student feedback was completely different:
Student A: writes brute force, runs it, gets wrong answer
Needs: dry run on the failing case
Never needed: approach validation at all

Student B: knows the pattern, can't implement
Needs: implementation direction immediately
Types 1-4 are completely irrelevant

Student C: gets TLE three times with a Segment Tree
on a problem that needs Sliding Window
Needs: step back and look at N again
Not: another complexity hint
The numbered sequence was a curriculum. Students needed a reactive system.
Realization: Stop tracking which hint number the student is on. Start reading what their current state actually tells you.

Problem 3 — The Approach Validation Was Spoiling the Learning
During the walkthrough of Set Matrix Zeroes, we caught something subtle. When the student described their approach — scan matrix, find zeros, set rows and columns — the AI warned them:

"Be careful — if you set cells to zero while scanning, what happens when your scan reaches a cell you just zeroed?"

That warning killed the most valuable learning moment in the entire session. The student was supposed to hit that bug themselves. The compiler was supposed to be the teacher. We handed them the answer before they even wrote a line.
Fix: The Spoiler Firewall. Approach validation does exactly one thing — confirm whether the approach is logically feasible. It says nothing about implementation traps. Nothing about edge cases. Nothing about what might go wrong. The student must be allowed to hit the bug so they can learn from it.
Approach validation confirms: "Will this produce the right output if implemented correctly?"
Approach validation never says: "Watch out for..."

Problem 4 — The System Had No Memory of the Student
Every hint request was stateless from the AI's perspective. The AI knew what was in the current prompt but nothing about this student as a person. It didn't know that this student always defaults to O(N²) without considering the sorted property. It didn't know they struggle with passing state up recursion trees. It didn't know they've never independently solved a DP problem.
A human mentor sitting next to a student accumulates this knowledge over time. It shapes how they ask questions.
Fix: StudentProfile — a separate MongoDB collection that grows with every session. After each solved problem, a lightweight AI call summarizes the session's hintLog observations into recurring mistakes and pattern-level insights. This gets injected into every future hint request.
"This student's recurring mistake: modifies data structure
during the traversal that reads it — needs two-pass pattern"
Now the AI isn't coaching a generic student. It's coaching this specific student with their specific blindspots.

Problem 5 — The Prompt Was Doing Too Many Jobs
The single system prompt was trying to handle everything: entry gate logic, Socratic hints, code correction, post-solve reflection. At ~3000 tokens it was causing attention drift — the AI was losing focus on later instructions.
More critically, it was expensive. Sending 3000 tokens of instructions for a simple comprehension check is wasteful.
Fix: Three stage-specific prompts.
Prompt A — Gatekeeper (800 tokens)
Entry gate, constraint coach, comprehension, approach validation
Used only at session start

Prompt B — Socratic Mentor (1500 tokens)  
 All hint types during main coding phase
Used for 80% of requests

Prompt C — Code Fixer (600 tokens)
Line-specific surgical feedback
Used only when hintsGiven >= 5 and student has substantial code
53% token reduction. More focused outputs. Less hallucination risk.

Problem 6 — Students Could Game the System
Two gaming patterns emerged:
Pattern A — Hint velocity gaming:
Student clicks Get Hint every 30 seconds without actually thinking. Discovers that 3 "I don't know" responses unlock the partial reveal.
Pattern B — Copy-paste gaming:
Student pastes a solution from another tab. Code jumps from empty to 40 lines of correct solution in under 2 minutes.
For hint velocity: track timestamps. If velocity exceeds 1 hint per minute — pause. Force a mandatory dry run before next hint unlocks. Timer stored server-side so page refresh doesn't reset it.
For copy-paste: detect the jump. But don't accuse. Instead issue a Logic Trap — ask a question that requires understanding the specific code, not just reading it.
"If I changed the condition on line 8 from left < right
to left <= right, which test case would fail first and why?"
This can't be answered with ChatGPT in 10 seconds because it requires reasoning about their specific code. A student who wrote the code can answer it. A student who pasted it cannot.

Problem 7 — The Compiler Was Talking But Nobody Was Listening
The execute route and the hint route were completely disconnected. Student ran code, got TLE, then manually asked for a hint. The AI had no idea what Judge0 had just returned.
This meant the AI was guessing why the student was stuck instead of knowing.
Fix: Compiler-reactive routing. After every execution, the result is saved to the Session document. The hint route reads it before calling Groq and uses it as the primary signal for hint type selection.
TLE → complexity check (reference specific N constraint)
Runtime Error → guided failure (reference specific crash and input)
Wrong Answer → dry run (reference specific failing test case)
The compiler already knows what went wrong. We just needed to route to the right question based on what it said.

Problem 8 — One Specific Gap: Wrong Answer AND TLE Simultaneously
A student's code can be both logically wrong and too slow at the same time. Original routing handled WA first (correct) but said nothing about the pending TLE. Student fixed the logic, ran again, got TLE, felt blindsided.
Fix: One flag, one sentence.
When WA and TLE coexist, the dry run hint ends with:
"We'll fix the logic first. Once your output is correct,
we'll look at why it's timing out."
Student knows what's coming. No surprise.

Problem 9 — Missing States That Real Students Hit
Three rounds of student feedback — real 3rd year CS students preparing for placements — revealed states the architecture didn't cover:
Local Success Global Failure:
Visible tests pass. Hidden tests fail. Most emotionally frustrating moment in DSA prep. Student thinks they're done. The response isn't "here's the failing case" — it's edge case brainstorming. Ask them to audit their own assumptions.
Analysis Paralysis:
10+ minutes, no code, no keystrokes. Not stuck — overwhelmed. Generic "are you okay" check-ins don't help. Anchor to brute force. Always. It's achievable. It breaks the inertia.
Pattern Pivot:
Student has TLEd twice with 60+ lines of Segment Tree code on a problem that needs Sliding Window. Not a complexity hint — an architecture audit. "Look at N again. Is there something simpler you're overlooking?"
Integer Overflow:
Constraints say answer can reach 10¹². Student uses int in Java. Logic is perfect. Code fails on large inputs. Detectable without AI — pure static analysis. Zero quota cost.

Problem 10 — Post-Solve Was Giving Away the Pattern Card
The pattern card was returned on solve. Student got it without having to articulate anything. This created fake wins — student completed the problem, got the card, felt good, but couldn't reproduce the insight tomorrow.
Fix: Reflection Gate. Pattern card is locked until the student answers one specific question:
"What was the signal in THIS problem that told you
Two Pointers would work?"
Vague answer gets one follow-up. Specific answer unlocks the card plus a hook:
"Sorted array + pair sum = Two Pointers. Every time."
This one-liner is what survives interview panic. It's not a definition. It's a trigger.

The Student-Driven Hint Selection Idea
Late in the architecture process, you raised something important: instead of the AI figuring out which hint type a student needs, let the student choose.
This was genuinely good thinking. A student who's been staring at their code for 20 minutes knows whether they need complexity help or a dry run. Better than the AI guessing.
But it has one real problem: beginners will always pick the easiest option. White belt student clicks "Pattern Reveal" on their first hint request. Learns nothing about why the pattern fits.
Hybrid resolution:
White/Yellow belt → single Get Hint button, AI routes
Green belt → limited menu, only types appropriate for current state
Brown/Black belt → full menu, earned autonomy
The routing complexity doesn't disappear for beginners. But for advanced students who've proven genuine mastery, they get agency. That's appropriate.

The Final Architecture

The State Machine — What Actually Drives Everything
Every hint request runs through determineHintType() before touching Groq. This function reads observable signals and returns the right intervention type. No guessing.
SIGNAL PRIORITY ORDER (first match wins):

PRIORITY 0 — Static Analysis (no AI, no quota)
Integer overflow: constraints mention 10^9+ AND code uses int in Java/C++
→ Return overflow warning immediately

PRIORITY 1 — No Code Exists
Empty editor, elapsed > 10 minutes
→ Analysis paralysis: "Describe the brute force in plain English"

Empty editor, has approach typed
→ Approach validation: confirm feasibility only, no implementation hints

Empty editor, no approach, early
→ Blank screen: "What's your first instinct?"

PRIORITY 2 — Code Exists, Never Run
→ "Run your code first. Let's see what it does."
→ Zero quota — not a real hint

PRIORITY 3 — Compiler Results (highest signal quality)
Runtime Error
→ Guided failure: reference specific crash + specific input

Wrong Answer, no TLE history
→ Dry run: trace the specific failing case

Wrong Answer WITH recent TLE
→ Dry run + one sentence: "We'll fix logic first, then timing"

Visible pass + hidden fail
→ Edge case brainstorm: audit empty input, single element, overflow, negatives

TLE, first occurrence
→ Complexity check: reference specific N constraint

TLE, second+ occurrence, code > 60 lines
→ Pattern pivot: "Look at N again. Is there something simpler?"

PRIORITY 4 — Tests Passing
All visible pass, student wants hint
→ Optimality check: "What's your current time complexity?"

PRIORITY 5 — Deep Session Fallback
hintsGiven >= 5, substantial code
→ Code correction: line-specific surgical question

PRIORITY 6 — Default
→ Socratic: general question about current code

The Three Prompts
Prompt A — Gatekeeper
Handles session entry. Used only when hintsGiven === 0 OR approachValidated === false.
Key rules:

Constraint coach fires once per session
Comprehension check confirms student understood the output
Approach validation confirms logical feasibility ONLY
Spoiler Firewall: never predict implementation bugs during validation
Belt-based skipping: Green+ belts skip to code directly

Prompt B — Socratic Mentor
Handles all hint types during the main coding phase.
Key rules:

Spoiler Firewall (repeated from A — most critical invariant)
Context drift: if code hash changed significantly, ignore previous conversation, meet student where they are
Compiler-reactive sections: specific instructions per compiler status
Logic trap: when paste detected, ask about specific line logic
Frustration tone: isFrustrated: true flag changes tone not method
Lateral hints: when student hasn't made meaningful code change, give different angle at same level, don't increment quota
Every response ends with ?
Never write code

Prompt C — Code Fixer
Used when hintsGiven >= 5.
Key rules:

Must reference specific line number
Guided failure: make them trace the crash, don't hand the fix
One line at a time
Still ends with ?

Session Schema
typescript{
// Identity
userId: ObjectId
problemSlug: string
language: string

// Belt snapshot (never changes mid-session)
beltAtSessionStart: BeltLevel

// Gate flags
constraintCoachDone: boolean
comprehensionCheckDone: boolean
approachValidated: boolean
approachType: "brute_force" | "optimal" | null

// Hint progression
hintsGiven: number
currentMode: HintMode
lateralHintsAtLevel: Record<number, number>

// Code state
currentCodeHash: string // SHA-256 of normalized code
codeHistory: string[] // append on every hint request
lastMeaningfulChangeAt: Date
contextDriftDetected: boolean // significant rewrite detected

// Compiler state
lastExecutionResult: {
status: "TLE" | "Runtime Error" | "Wrong Answer" | "Accepted" | null
stderr: string | null
failedTestInput: string | null
failedExpected: string | null
failedActual: string | null
}
lastRunPassed: boolean
hiddenTestFailed: boolean
tleCount: number // for pattern pivot detection

// Gaming detection (server-side only)
hintTimestamps: Date[]
cooldownUntil: Date | null
logicTrapPending: boolean
logicTrapQuestion: string | null

// Student state
lastActivityAt: Date
isFrustrated: boolean
inactivityNudgeCount: number

// Solve state
solved: boolean
assistedSolve: boolean
reflectionAnswer: string | null
patternCard: PatternCard | null
tradeoffQuestion: string | null

// Learning log
hintLog: [{
hintNumber: number
mode: HintMode
codeStateHash: string // bound to code at time of hint
aiObservation: string
misconception: string | null
isLateral: boolean
compilerStatus: string | null
timestamp: Date
}]

status: "active" | "solved" | "revisit" | "abandoned"
timestamps: true
}

StudentProfile Schema
typescript{
userId: ObjectId // unique index

belt: BeltLevel
beltUpdatedAt: Date

totalAttempted: number
totalSolved: number
totalHintsUsed: number

patternData: {
[pattern: DSAPattern]: {
attempted: number
solved: number
avgHintsNeeded: number
lastMisconception: string | null
lastAttemptedAt: Date
}
}

recurringMistakes: string[] // max 10, rolling window
strongPatterns: DSAPattern[]

revisitQueue: [{
problemSlug: string
siblingSlug: string | null
dueAt: Date
revisitNumber: 1 | 2 | 3
}]

lastUpdated: Date
}

API Routes — Final Map
Auth (unchanged):
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout

Problems (unchanged):
GET /api/problems
GET /api/problems/[slug]

Hint System (updated):
POST /api/kodex/hint — main hint flow
PATCH /api/kodex/hint — "I Solved It" + hidden tests
GET /api/kodex/hint — quota status

Concept/Librarian (unchanged):
POST /api/kodex/concept
GET /api/kodex/concept

Execute (updated — saves compiler result to session):
POST /api/kodex/execute

Nudge (new — zero quota, timer-based):
POST /api/kodex/nudge

Dashboard (bug fixed):
GET /api/dashboard

Grimoire (unchanged):
GET /api/grimoire

Profile (unchanged):
GET /api/user/profile
PATCH /api/user/profile

The Complete Request Flow
POST /api/kodex/hint
│
▼
JWT verify
│
▼
Redis quota check (fail fast — before any DB calls)
│
▼
Parse body:
{ problemSlug, userCode, language, hintsGiven,
conversationHistory, sessionId, studentApproach,
hintType (null for white/yellow), solved }
│
▼
Fetch problem from MongoDB
.select("-pattern") ← never expose pattern
│
▼
Fetch or create Session
│
▼
Compute CodeStateHash
Compare to session.currentCodeHash
Set contextDriftDetected if significant change
│
▼
Run static analysis (integer overflow check)
If warning found → return immediately, no Groq, no quota
│
▼
Pre-Groq decision tree:
├── Syntax query? → Prompt D (syntax bridge) → return, no quota
├── Cooldown active? → return cooldown message, no quota
├── Logic trap pending? → evaluate answer → continue or re-ask
├── Gaming (velocity)? → forced dry run, no quota increment
└── Normal → continue
│
▼
determineHintType()
Reads: code state, lastExecution, elapsed time,
hintsGiven, tleCount, belt, studentApproach
Returns: hint type + hasPendingTLE flag
│
▼
Fetch StudentProfile
Build profile context string
If no profile → cold start context from User model
│
▼
Detect frustration
sessionDuration > 40min AND hintsGiven > 3
AND lastActivityAt gap > 6min
→ set isFrustrated: true
│
▼
Select prompt (A / B / C)
A: hintsGiven === 0 OR !approachValidated
C: hintsGiven >= 5
B: everything else
│
▼
Build userMessage:
Problem title + description + examples + constraints
Current code (or "NO CODE WRITTEN YET" marker)
Current code hash
contextDriftDetected flag
isFrustrated flag
hasPendingTLE flag
Compiler context (if override)
StudentProfile context
Hint type instruction
Trimmed conversation history (first + last 4)
│
▼
Groq API call
Model: llama-3.3-70b-versatile (Coach)
Temperature: 0.6
Max tokens: 1000
│
▼
Redis INCR
Only if: not lateral, not syntax, not static warning,
not run_first, not cooldown, not nudge
│
▼
Update Session:
Append to hintLog (with code hash binding)
Append to hintTimestamps
Append to codeHistory
Update currentCodeHash
Update lateralHintsAtLevel
Update currentMode, hintsGiven
│
▼
If solved: true
├── Reflection gate question (no card yet)
├── On reflection answered → generate pattern card
├── Tag assistedSolve if applicable
├── Schedule spaced repetition (day 3, 7, 21)
└── setImmediate → updateStudentProfile (async, fire-forget)
│
▼
Return response

What Is Deferred to V2
Trace injection
Injecting print statements into student code to capture
variable state for AI analysis. High value, high complexity.
Build after launch when you have real failure patterns to study.

Vocalize Mode  
 Student explains implementation plan before coding.
Builds interview communication muscle.
High latency, high complexity. Make it a Pro feature.

Spaghetti Code detection
Cyclomatic complexity analysis across 5 languages.
Needs AST parsing not regex. Not worth pre-launch.

Semantic caching
Redis cache for common compiler-reactive hints.
Premature optimization. No users yet.
Add when Groq costs become real.

Sibling problem auto-generation
AI suggests related problems for spaced repetition day 7 + 21.
Manual curation for launch. Auto-generation in V2.

Full Belt System UI
Belt display in nav, progression visualization.
Belt calculation logic ships in V1.
UI treatment in V2.

Build Order
PHASE 1 — Backend Complete + Tested
Week 1: 1. Fix hint route (problemSlug, spoiler firewall) 2. Write determineHintType() state machine 3. Write static analysis (integer overflow) 4. Rewrite Prompt A (Gatekeeper) 5. Rewrite Prompt B (Socratic Mentor — all new sections) 6. Write Prompt C (Code Fixer)

Week 2: 7. Update Session schema (all new fields) 8. Create StudentProfile model 9. Write updateStudentProfile() (async, post-solve) 10. Update execute route (save compiler result to session) 11. Write nudge route (zero quota, timer-based) 12. Wire everything into hint route 13. Full Postman test across all states

PHASE 2 — Frontend
Week 3-4: 14. Fix Nav.tsx + layout.tsx 15. Build problems/[slug]/page.tsx (core product) 16. Build dashboard/page.tsx 17. Build grimoire/page.tsx 18. Build profile/page.tsx 19. Build landing page

PHASE 3 — Deploy
Week 5: 20. Judge0 CE on EC2 (t3.small, $50 budget) 21. Next.js on EC2 (separate instance) 22. Nginx + SSL 23. Environment variables 24. Smoke test production

Honest Assessment — What We Don't Know Yet
The architecture is logically sound. The student feedback validated the philosophy. The SDE critique caught the real engineering risks.
But three things remain genuinely uncertain:
Will the state machine get it right consistently?
determineHintType() is deterministic — given the same inputs it always returns the same type. But the inputs depend on what Judge0 returns, what the student wrote, how long they've been idle. Edge cases exist that we haven't modeled. We'll find them in real usage.
Will the AI stay in character under all states?
Prompt B is handling 8+ different hint types with specific instructions for each. LLMs can drift — follow early instructions and ignore later ones. Split prompts reduce this but don't eliminate it. Real testing with real problems will reveal where the prompts break.
Will students find it too much friction or not enough?
We designed for learning. Learning requires friction. But too much friction causes churn. The belt system is the safety valve — beginners get full coaching, advanced students get autonomy. Whether the thresholds are right is something only real usage can answer.
These aren't reasons to not build it. They're reasons to ship it, watch it, and iterate.
