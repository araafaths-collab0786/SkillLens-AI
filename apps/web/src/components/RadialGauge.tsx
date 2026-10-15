/**
 * RadialGauge — reusable animated radial score gauge.
 *
 * Animates from `fromValue` to `value` on mount (or on value change).
 * Respects prefers-reduced-motion.
 * Used on /match (current Readiness Index) and /gap-analysis (projected bar).
 *
 * Props:
 *   value          — target score 0–100
 *   fromValue      — starting value for the animation (default 0)
 *   size           — SVG side length in px (default 160)
 *   strokeWidth    — ring thickness (default 14)
 *   label          — text below the score (e.g. "Readiness Index")
 *   sublabel       — smaller muted text (e.g. "Software Engineer")
 *   uncalibrated   — when true, shows the uncalibrated notice
 *   className      — extra classes on the container
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface RadialGaugeProps {
  value: number;
  fromValue?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  uncalibrated?: boolean;
  className?: string;
}

const DURATION_MS = 1200;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function RadialGauge({
  value,
  fromValue = 0,
  size = 160,
  strokeWidth = 14,
  label,
  sublabel,
  uncalibrated = false,
  className,
}: RadialGaugeProps) {
  const [displayed, setDisplayed] = useState(fromValue);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setDisplayed(value);
      return;
    }

    const start = performance.now();
    const from = fromValue;
    const to = value;

    const animate = (now: number) => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      const eased = easeOutCubic(t);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (displayed / 100) * circumference;

  // Severity colour for the fill
  const fillColor =
    displayed >= 70 ? "#06B6D4" : displayed >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`Readiness Index: ${displayed} out of 100`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
          className="rotate-[-90deg]"
        >
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
          />
          {/* Fill */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={fillColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.05s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-deep-navy leading-none">{displayed}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>

      {label && (
        <div className="text-center">
          <p className="text-sm font-semibold text-deep-navy">{label}</p>
          {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
        </div>
      )}
      {uncalibrated && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-center max-w-[200px]">
          Contains uncalibrated semantic matches
        </p>
      )}
    </div>
  );
}
