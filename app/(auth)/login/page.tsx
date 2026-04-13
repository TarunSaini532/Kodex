"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "something went wrong");
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setError("Network error. Please try again later ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-kodex-bg flex items-center justify-center px-4">
      {/* subtle grid background */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#F4D03F 1px, transparent 1px), linear-gradient(90deg, #F4D03F 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* logo */}
        <div className="mb-10">
          <h1 className="font-mono text-2xl font-bold text-kodex-text tracking-tight">
            Kō<span className="text-kodex-accent">dex</span>
          </h1>
          <p className="text-kodex-muted text-sm mt-1 font-mono">
            The dojo. Not the answer sheet.
          </p>
        </div>

        {/* form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-kodex-surface border border-kodex-border text-kodex-text font-mono text-sm px-3 py-2.5 rounded-[4px] outline-none focus:border-kodex-accent transition-colors placeholder:text-kodex-muted/40"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-kodex-surface border border-kodex-border text-kodex-text font-mono text-sm px-3 py-2.5 rounded-[4px] outline-none focus:border-kodex-accent transition-colors placeholder:text-kodex-muted/40"
              placeholder="••••••••"
            />
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
            {loading ? "Entering dojo..." : "Enter"}
          </button>
        </form>

        {/* divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-kodex-border" />
          <span className="text-kodex-muted text-xs font-mono">or</span>
          <div className="flex-1 h-px bg-kodex-border" />
        </div>

        {/* register link */}
        <p className="text-center text-xs font-mono text-kodex-muted">
          No account?{" "}
          <Link
            href="/register"
            className="text-kodex-accent hover:underline underline-offset-4"
          >
            Begin training
          </Link>
        </p>
      </div>
    </main>
  );
}
