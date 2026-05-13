"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { useState, useEffect } from "react";

// Type-safe constants
const KNOWN_CONCEPTS = [
  "arrays",
  "hashmaps",
  "recursion",
  "sorting",
  "linked lists",
  "trees",
  "graphs",
  "dynamic programming",
] as const;
type KnownConcept = (typeof KNOWN_CONCEPTS)[number];

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner (0–20 problems)" },
  { value: "intermediate", label: "Intermediate (20–100 problems)" },
  { value: "advanced", label: "Advanced (100+ problems)" },
] as const;
type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]["value"];

// Password strength evaluator
function getPasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  return strength; // 0-4
}

function getStrengthLabel(score: number): string {
  if (score === 0) return "Very weak";
  if (score === 1) return "Weak";
  if (score === 2) return "Fair";
  if (score === 3) return "Good";
  return "Strong";
}

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    knownConcepts: [] as KnownConcept[],
    experienceLevel: "beginner" as ExperienceLevel,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Update strength when password changes
  useEffect(() => {
    setPasswordStrength(getPasswordStrength(formData.password));
  }, [formData.password]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;

    if (type === "checkbox") {
      setFormData((prev) => {
        const concepts = checked
          ? [...prev.knownConcepts, name as KnownConcept]
          : prev.knownConcepts.filter((c) => c !== name);
        return { ...prev, knownConcepts: concepts };
      });
    } else if (name === "experienceLevel") {
      setFormData((prev) => ({
        ...prev,
        experienceLevel: value as ExperienceLevel,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    const strength = getPasswordStrength(formData.password);
    if (strength < 2) {
      setError(
        "Password is too weak. Use mix of upper/lower case, numbers, and symbols.",
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          knownConcepts: formData.knownConcepts,
          experienceLevel: formData.experienceLevel,
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Registration failed");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-kodex-bg flex items-center justify-center px-4 overflow-hidden">
      <div className="fixed inset-0 opacity-[0.035] bg-grid-pattern" />

      <div className="relative w-full max-w-md">
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

        <div className="bg-kodex-surface border border-kodex-border rounded-kodex p-8 shadow-2xl">
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
                NAME
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                autoComplete="name"
                className="w-full bg-kodex-editor border border-kodex-border text-kodex-text font-mono text-sm px-4 py-3 rounded-kodex focus:outline-none focus:ring-2 focus:ring-kodex-accent/50 focus:border-transparent"
                placeholder="Tarun Saini"
              />
            </div>
            {/* Email */}
            <div>
              <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
                EMAIL
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="w-full bg-kodex-editor border border-kodex-border text-kodex-text font-mono text-sm px-4 py-3 rounded-kodex focus:outline-none focus:ring-2 focus:ring-kodex-accent/50"
                placeholder="you@example.com"
              />
            </div>
            {/* // Password field */}
            <div className="relative">
              <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
                PASSWORD
              </label>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="w-full bg-kodex-editor border border-kodex-border text-kodex-text font-mono text-sm px-4 py-3 rounded-kodex focus:outline-none focus:ring-2 focus:ring-kodex-accent/50 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-kodex-muted hover:text-kodex-accent"
                tabIndex={-1}
              >
                {showPassword ? <Eye /> : <EyeOff />}
              </button>
            </div>
            {/* // Confirm password field */}
            <div className="relative">
              <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
                CONFIRM PASSWORD
              </label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="off"
                className="w-full bg-kodex-editor border border-kodex-border text-kodex-text font-mono text-sm px-4 py-3 rounded-kodex focus:outline-none focus:ring-2 focus:ring-kodex-accent/50 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-kodex-muted hover:text-kodex-accent"
                tabIndex={-1}
              >
                {showConfirmPassword ? <Eye /> : <EyeOff />}
              </button>
            </div>
            {/* Experience Level */}
            <div>
              <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
                YOUR CURRENT LEVEL
              </label>
              <div className="grid grid-cols-1 gap-2">
                {EXPERIENCE_LEVELS.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-3 bg-kodex-editor border border-kodex-border hover:border-kodex-accent/40 rounded-kodex px-4 py-3 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="experienceLevel"
                      value={value}
                      checked={formData.experienceLevel === value}
                      onChange={handleChange}
                      className="accent-kodex-accent w-4 h-4"
                    />
                    <span className="text-kodex-text font-mono text-sm">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {/* Known Concepts */}
            <div>
              <label className="block text-xs font-mono text-kodex-muted mb-1.5 uppercase tracking-widest">
                CONCEPTS YOU ALREADY KNOW
              </label>
              <div className="grid grid-cols-2 gap-2">
                {KNOWN_CONCEPTS.map((concept) => (
                  <label
                    key={concept}
                    className="flex items-center gap-2 bg-kodex-editor border border-kodex-border hover:border-kodex-accent/40 rounded-kodex px-3 py-2 cursor-pointer transition-colors text-sm font-mono"
                  >
                    <input
                      type="checkbox"
                      name={concept}
                      checked={formData.knownConcepts.includes(concept)}
                      onChange={handleChange}
                      className="accent-kodex-accent"
                    />
                    <span className="text-kodex-text capitalize">
                      {concept}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-kodex-muted/70 mt-2 font-mono">
                Select all that apply. You can update this later.
              </p>
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
                <div className="animate-spin h-4 w-4 border-2 border-kodex-bg border-t-transparent rounded-full" />
              ) : (
                "Begin Training →"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs font-mono text-kodex-muted mt-8">
          Already walking the path?{" "}
          <Link
            href="/login"
            className="text-kodex-accent hover:text-amber-400 transition-colors underline-offset-4 hover:underline"
          >
            Enter the dojo
          </Link>
        </p>
      </div>
    </main>
  );
}
