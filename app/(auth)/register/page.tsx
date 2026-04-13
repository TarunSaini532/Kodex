"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CONCEPTS = [
  "arrays",
  "hashmaps",
  "recursion",
  "sorting",
  "linked lists",
  "trees",
  "graphs",
  "dynamic programming",
];

const LEVELS = [
  { value: "beginner", label: "Beginner", desc: "0–20 problems" },
  { value: "intermediate", label: "Intermediate", desc: "20–100 problems" },
  { value: "advanced", label: "Advanced", desc: "100+ problems" },
];

export default function RegsiterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [knownConcepts, setKnownConcepts] = useState<string[]>([]);
  const [experienceLevel, setLevel] = useState("beginner");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleConcept(concept: string) {
    setKnownConcepts((prev) => {
      const updated = prev.includes(concept)
        ? prev.filter((c) => c !== concept)
        : [...prev, concept];
      console.log("concepts:", updated); // ← add this
      return updated;
    });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          knownConcepts,
          experienceLevel,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong");
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setError("Network error, Please try again later");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-kodex-bg flex items-center justify-center px-4 py-12">
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#F4D03F 1px, transparent 1px), linear-gradient(90deg, #F4D03F 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* logo */}
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-kodex-text tracking-tight">
            Kō<span className="text-kodex-accent">dex</span>
          </h1>
          <p className="text-kodex-muted text-sm mt-1 font-mono">
            Begin your training.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* name */}
          <div>
            <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-kodex-surface border border-kodex-border text-kodex-text font-mono text-sm px-3 py-2.5 rounded-[4px] outline-none focus:border-kodex-accent transition-colors placeholder:text-kodex-muted/40"
              placeholder="Your name"
            />
          </div>

          {/* email */}
          <div>
            <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-kodex-surface border border-kodex-border text-kodex-text font-mono text-sm px-3 py-2.5 rounded-[4px] outline-none focus:border-kodex-accent transition-colors placeholder:text-kodex-muted/40"
              placeholder="you@example.com"
            />
          </div>

          {/* password */}
          <div>
            <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-kodex-surface border border-kodex-border text-kodex-text font-mono text-sm px-3 py-2.5 rounded-[4px] outline-none focus:border-kodex-accent transition-colors placeholder:text-kodex-muted/40"
              placeholder="Min. 6 characters"
            />
          </div>

          {/* known concepts */}
          <div>
            <label className="block text-xs font-mono text-kodex-muted mb-2 uppercase tracking-widest">
              What do you already know?
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {CONCEPTS.map((concept) => (
                <button
                  key={concept}
                  type="button"
                  onClick={() => toggleConcept(concept)}
                  className={`text-left px-3 py-2 rounded-[4px] font-mono text-xs border transition-colors ${
                    knownConcepts.includes(concept)
                      ? "border-kodex-accent bg-kodex-accent/10 text-kodex-accent"
                      : "border-kodex-border bg-kodex-surface text-kodex-muted hover:border-kodex-muted"
                  }`}
                >
                  {concept}
                </button>
              ))}
            </div>
          </div>

          {/* experience level */}
          <div>
            <label className="block text-xs font-mono text-kodex-muted mb-2 uppercase tracking-widest">
              Experience Level
            </label>
            <div className="space-y-1.5">
              {LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setLevel(level.value)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[4px] border font-mono text-xs transition-colors ${
                    experienceLevel === level.value
                      ? "border-kodex-accent bg-kodex-accent/10 text-kodex-accent"
                      : "border-kodex-border bg-kodex-surface text-kodex-muted hover:border-kodex-muted"
                  }`}
                >
                  <span>{level.label}</span>
                  <span className="opacity-50">{level.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* error */}
          {error && (
            <p className="text-kodex-danger text-xs font-mono border border-kodex-danger/20 bg-kodex-danger/5 px-3 py-2 rounded-[4px]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kodex-accent text-kodex-bg font-mono font-bold text-sm py-2.5 rounded-[4px] hover:bg-kodex-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Entering dojo..." : "Start Training"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-kodex-border" />
          <span className="text-kodex-muted text-xs font-mono">or</span>
          <div className="flex-1 h-px bg-kodex-border" />
        </div>

        <p className="text-center text-xs font-mono text-kodex-muted">
          Already training?{" "}
          <Link
            href="/login"
            className="text-kodex-accent hover:underline underline-offset-4"
          >
            Enter dojo
          </Link>
        </p>
      </div>
    </main>
  );
}
