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
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Invalid credentials");
        return;
      }

      router.push("/dashboard");
      router.refresh(); 
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-kodex-bg flex items-center justify-center px-4 overflow-hidden">
      {/* Subtle Dojo grid background */}
      <div
        className="fixed inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #F4D03F 1px, transparent 1px),
            linear-gradient(to bottom, #F4D03F 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full border border-kodex-accent/30 flex items-center justify-center">
              <span className="text-kodex-accent text-xl font-bold">刀</span>
            </div>
            <h1 className="font-mono text-4xl font-bold tracking-tighter text-kodex-text">
              Kō<span className="text-kodex-accent">dex</span>
            </h1>
          </div>
          <p className="text-kodex-muted text-sm font-mono">
            The dojo. Not the answer sheet.
          </p>
        </div>

        {/* Card */}
        <div className="bg-kodex-surface border border-kodex-border rounded-kodex p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-kodex-editor border border-kodex-border text-kodex-text font-mono text-sm px-4 py-3 rounded-kodex outline-none focus:border-kodex-accent focus:ring-1 focus:ring-kodex-accent/30 transition-all placeholder:text-kodex-muted/50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-kodex-editor border border-kodex-border text-kodex-text font-mono text-sm px-4 py-3 rounded-kodex outline-none focus:border-kodex-accent focus:ring-1 focus:ring-kodex-accent/30 transition-all placeholder:text-kodex-muted/50"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-kodex-danger text-sm font-mono border-l-2 border-kodex-danger pl-3 py-1 bg-kodex-danger/5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-kodex-accent hover:bg-amber-400 active:bg-amber-500 text-kodex-bg font-mono font-semibold text-sm py-3.5 rounded-kodex transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>Entering the dojo...</>
              ) : (
                <>
                  Enter the Dojo <span className="text-base">→</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Register link */}
        <p className="text-center text-xs font-mono text-kodex-muted mt-8">
          New to the path?{" "}
          <Link
            href="/register"
            className="text-kodex-accent hover:text-amber-400 transition-colors underline-offset-4 hover:underline"
          >
            Begin your training
          </Link>
        </p>
      </div>
    </main>
  );
}
