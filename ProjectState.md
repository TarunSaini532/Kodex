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