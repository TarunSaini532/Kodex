# Kōdex

A placement-focused DSA learning platform built on Striver's SDE Sheet. Kōdex acts like a Senior SDE sitting next to you — guiding through Socratic questioning rather than giving answers. The core philosophy is building mental frameworks for pattern recognition, not green checkmarks.

---

## The Problem It Solves

Most DSA platforms train students to recognize tags and hints, not problems. In a real interview there are no tags, no hints, no internet. Students memorize solutions instead of building the mental model to derive them. Kōdex fixes this by making the AI refuse to give answers — it only asks better questions.

---

## Tech Stack

**Frontend**

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Monaco Editor (`@monaco-editor/react`)
- Recharts — radar chart for placement readiness dashboard
- Mermaid.js — visual diagrams in Librarian mode
- Framer Motion — animations
- canvas-confetti — victory state on solve

**Backend** (Next.js API Routes, Node.js runtime)

- JWT (`jsonwebtoken` + `bcryptjs`) for auth
- Mongoose as MongoDB ODM

**Databases**

- MongoDB Atlas — permanent data (users, sessions, problems)
- Redis Upstash — daily quota tracking (HTTP-based, no TCP)

**AI Layer**

- Groq API
  - `llama-3.3-70b-versatile` → Coach mode (hint progression)
  - `llama-3.1-8b-instant` → Librarian mode (concept questions)

**Code Execution**

- Judge0 via RapidAPI free tier

**Deployment**

- AWS EC2 (Next.js app) + Nginx (reverse proxy)
- Docker (containerization)
- AWS S3 (future — profile images)

---

## Local Setup

### Prerequisites

- Node.js 18+
- MongoDB Atlas account
- Redis Upstash account
- Groq API key
- Judge0 API key (RapidAPI)

### Install

```bash
git clone https://github.com/your-username/kodex.git
cd kodex
npm install
```

### Environment Variables

Create `.env.local` in the root:

```env
MONGODB_URI=
JWT_SECRET=
GROQ_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JUDGE0_API_KEY=
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed Problems

```bash
npx ts-node scripts/seedProblems.ts
```

---

## Core Concepts

**Coach Mode** — 7-level Socratic hint progression. Never writes code. Every hint ends with a question. Pattern name revealed only at hint 4. Quota: 50 hints/day per user.

**Librarian Mode** — Concept clarification using the Sandwich Method (analogy → technical trace → redirect back to their code). Generates Mermaid diagrams for visual concepts. Quota: 5 questions/day per user.

**Inactivity Nudge** — After 4 minutes of no activity, hint button gently pulses. Zero API cost until clicked.

**Pattern Cards** — Earned on solve. Show 3 recognition signals + one-line summary. Collected in the Grimoire.

**Judge0 Gate** — "I Solved It" only activates after code runs successfully. Prevents self-reporting without execution.

---

## Project Structure

```
kodex/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register/route.ts
│   │   │   └── login/route.ts
│   │   ├── kodex/
│   │   │   ├── hint/route.ts
│   │   │   ├── concept/route.ts      ← pending
│   │   │   └── execute/route.ts      ← pending
│   │   ├── problems/
│   │   │   ├── route.ts              ← pending
│   │   │   └── [slug]/route.ts       ← pending
│   │   ├── dashboard/route.ts        ← pending
│   │   └── user/profile/route.ts
│   ├── (auth)/
│   │   ├── login/page.tsx            ← pending
│   │   └── register/page.tsx         ← pending
│   ├── problems/
│   │   ├── page.tsx                  ← pending
│   │   └── [slug]/page.tsx           ← pending
│   ├── dashboard/page.tsx            ← pending
│   ├── grimoire/page.tsx             ← pending
│   ├── profile/page.tsx              ← pending
│   └── page.tsx                      ← pending
├── lib/
│   ├── mongodb.ts
│   ├── auth.ts
│   ├── redis.ts
│   ├── claude.ts
│   ├── librarian.ts                  ← pending
│   └── judge.ts                      ← pending
├── models/
│   ├── User.ts
│   ├── Session.ts
│   └── Problem.ts
├── components/
│   └── VictoryState.tsx              ← pending
└── scripts/
    ├── data/problems.json            ← pending
    └── seedProblems.ts               ← pending
```

---

## Quota System

| Mode      | Redis Key                    | Limit  | Reset    |
| --------- | ---------------------------- | ------ | -------- |
| Coach     | `quota:userId:YYYY-MM-DD`    | 50/day | 24hr TTL |
| Librarian | `concepts:userId:YYYY-MM-DD` | 5/day  | 24hr TTL |

Quota is checked before every Groq call (fail fast). Atomic INCR prevents race conditions. No cron jobs — TTL handles reset automatically.

---

## Key Architectural Decisions

- **Conversation history lives in React state**, not MongoDB or Redis. Sent with every request, trimmed server-side (first message + last 4 kept).
- **Pattern is never exposed** in problems API responses. Only revealed to the student at hint 4. Stored only in MongoDB.
- **`lib/claude.ts` and `lib/librarian.ts` are fully separate modules.** Each owns its model, system prompt, and quota key. Single Responsibility Principle — a change to Librarian touches exactly one file.
- **Judge0 gates the solve button.** `lastRunPassed` must be `true` on the Session before "I Solved It" activates.
