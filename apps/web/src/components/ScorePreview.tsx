/**
 * Animated score gauge preview for the hero section.
 * Shows a readiness score rising from 0 → 78% on mount.
 * Labeled "Illustrative example" — never claims to be a real result.
 * Respects prefers-reduced-motion.
 */
"use client";

import { useEffect, useRef, useState } from "react";

const TARGET = 78;
const DURATION_MS = 1800;

export function ScorePreview() {
  const [score, setScore] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Respect reduced-motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setScore(TARGET);
      return;
    }

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setScore(Math.round(eased * TARGET));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm w-full max-w-xs mx-auto"
      aria-label="Illustrative example: animated readiness score"
    >
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Illustrative example
      </p>

      {/* Radial gauge */}
      <div className="relative flex items-center justify-center" style={{ width: 112, height: 112 }}>
        <svg
          width="112"
          height="112"
          viewBox="0 0 112 112"
          aria-hidden="true"
          className="rotate-[-90deg]"
        >
          {/* Track */}
          <circle
            cx="56"
            cy="56"
            r="44"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="10"
          />
          {/* Fill */}
          <circle
            cx="56"
            cy="56"
            r="44"
            fill="none"
            stroke="#06B6D4"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.05s linear" }}
          />
        </svg>
        {/* Score label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-deep-navy leading-none">{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-deep-navy">Readiness Index</p>
        <p className="text-xs text-gray-500 mt-1">Frontend Developer · Sample role</p>
      </div>

      {/* Mini skill bars */}
      <div className="w-full space-y-2">
        {[
          { label: "React", pct: 90 },
          { label: "TypeScript", pct: 75 },
          { label: "Node.js", pct: 60 },
        ].map(({ label, pct }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-20 text-xs text-gray-600 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
