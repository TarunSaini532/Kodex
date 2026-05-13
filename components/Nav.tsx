"use client";

import { NavUser } from "@/app/(main)/layout";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";


interface NavProps {
  user: NavUser;
}


export default function Nav({ user }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const navLinks = [
    { href: "/problems", label: "Problems" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/grimoire", label: "Grimoire" },
  ];

  if (user.role === "admin") {
    navLinks.push({ href: "/admin", label: "Admin" });
  }

  return (
    <nav className="bg-kodex-surface border-b border-kodex-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/problems" className="flex-shrink-0 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border border-kodex-accent/40 flex items-center justify-center">
                <span className="text-kodex-accent text-base font-bold">刀</span>
              </div>
              <span className="font-mono text-xl font-bold tracking-tighter text-kodex-text">
                Kō<span className="text-kodex-accent">dex</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden sm:flex sm:items-center sm:space-x-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-mono border-b-2 transition-colors ${
                    isActive
                      ? "border-kodex-accent text-kodex-accent"
                      : "border-transparent text-kodex-muted hover:text-kodex-text hover:border-kodex-border/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-kodex-accent/50"
              >
                <div className="h-8 w-8 rounded-full bg-kodex-accent/10 border border-kodex-accent/30 flex items-center justify-center text-kodex-accent font-mono font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:inline text-kodex-text font-mono text-sm">
                  {user.name}
                </span>
                <svg
                  className="h-4 w-4 text-kodex-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-kodex-surface border border-kodex-border rounded-kodex shadow-xl py-1 z-50">
                  <div className="px-4 py-3 text-sm border-b border-kodex-border">
                    <p className="font-mono font-medium text-kodex-text">{user.name}</p>
                    <p className="text-xs font-mono text-kodex-muted mt-0.5">{user.email}</p>
                    <p className="text-xs font-mono text-kodex-muted/70 mt-1.5">
                      {user.experienceLevel} · {user.knownConcepts.length} concepts
                    </p>
                  </div>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm font-mono text-kodex-text hover:bg-kodex-editor transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Profile Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm font-mono text-kodex-danger hover:bg-kodex-editor transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}