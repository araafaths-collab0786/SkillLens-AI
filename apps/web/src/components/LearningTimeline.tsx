/**
 * LearningTimeline — animated learning-path timeline.
 *
 * Horizontal on tablet+ (md), vertical on phones.
 * Each step card shows: step number, skill label, recommendation title,
 * effort weeks, projected gain, and a progress checkbox.
 *
 * The "projected readiness" bar animates from current → projected.
 * Labeled "Estimated" per spec — never claims guaranteed outcomes.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { ProjectedReadiness } from "@skilllens/shared";

interface LearningTimelineProps {
  projected: ProjectedReadiness;
  className?: string;
}

const STEP_ICONS = ["📚", "💻", "🏆"];

function ProjectedBar({
  current,
  projected,
  disclaimer,
  uncalibrated,
}: {
  current: number;
  projected: number;
  disclaimer: string;
  uncalibrated: boolean;
}) {
  const shouldReduce = useReducedMotion();
  const [barWidth, setBarWidth] = useState(current);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (shouldReduce) {
      setBarWidth(projected);
      return;
    }
    // Small delay so the current bar renders first
    const timeout = setTimeout(() => {
      const start = performance.now();
      const from = current;
      const to = projected;
      const DURATION = 1000;

      const animate = (now: number) => {
        const t = Math.min((now - start) / DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setBarWidth(Math.round(from + (to - from) * eased));
        if (t < 1) rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    }, 400);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projected]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-deep-navy">Projected Readiness</p>
        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          Estimated
        </span>
      </div>

      {/* Current bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Current</span>
          <span className="font-semibold text-deep-navy">{current}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-gray-300 rounded-full"
            style={{ width: `${current}%` }}
          />
        </div>
      </div>

      {/* Projected bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>After top 3 steps</span>
          <span className="font-bold text-cyan-text">{barWidth}</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-none"
            style={{
              width: `${barWidth}%`,
              background: "linear-gradient(90deg, #06B6D4 0%, #0E7490 100%)",
            }}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        {projected.disclaimer}
      </p>

      {projected.uncalibrated && (
        <p className="text-xs text-amber-600">
          ⚠ This estimate includes uncalibrated semantic match scores.
        </p>
      )}
    </div>
  );
}

interface StepCardProps {
  step: ProjectedReadiness["topSteps"][number];
  index: number;
  isLast: boolean;
}

function StepCard({ step, index, isLast }: StepCardProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex md:flex-col items-start md:items-center gap-4 md:gap-0 relative">
      {/* Connector line (horizontal on md+, vertical on phone) */}
      {!isLast && (
        <>
          {/* Desktop horizontal connector */}
          <div
            className="hidden md:block absolute top-6 left-1/2 w-full h-0.5 bg-gray-200"
            aria-hidden="true"
          />
          {/* Mobile vertical connector */}
          <div
            className="md:hidden absolute top-10 left-5 w-0.5 h-[calc(100%+1rem)] bg-gray-200"
            aria-hidden="true"
          />
        </>
      )}

      {/* Step bubble */}
      <div
        className={cn(
          "relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-lg",
          checked
            ? "bg-cyan text-white"
            : "bg-white border-2 border-gray-200 text-gray-400"
        )}
        aria-hidden="true"
      >
        {checked ? "✓" : (STEP_ICONS[index] ?? String(step.stepOrder))}
      </div>

      {/* Card */}
      <div className="flex-1 md:flex-none md:w-full rounded-xl border border-gray-200 bg-white p-4 md:mt-4 space-y-2 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-deep-navy leading-tight">
            {step.escoLabel}
          </p>
          <label className="flex items-center gap-1.5 shrink-0 cursor-pointer min-h-[44px] min-w-[44px] justify-center">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-cyan focus:ring-2 focus:ring-cyan-text"
              aria-label={`Mark "${step.escoLabel}" step as complete`}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>
            Gain:{" "}
            <span className="font-semibold text-cyan-text">
              +{step.gainDelta.toFixed(1)} pts
            </span>
          </span>
          <span>
            Effort:{" "}
            <span className="font-medium text-deep-navy">
              {step.effortWeeks}w
            </span>
          </span>
          <span>
            Efficiency:{" "}
            <span className="font-medium text-deep-navy">
              {step.gainPerEffortWeek.toFixed(2)} pts/wk
            </span>
          </span>
        </div>

        {/* Progress bar for this step's gain */}
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-cyan/60 rounded-full"
            style={{ width: `${Math.min(step.gainDelta, 40) * 2.5}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function LearningTimeline({ projected, className }: LearningTimelineProps) {
  const shouldReduce = useReducedMotion();

  return (
    <div className={cn("space-y-6", className)}>
      {/* Projected readiness bar */}
      <ProjectedBar
        current={projected.currentReadiness}
        projected={projected.projectedReadiness}
        disclaimer={projected.disclaimer}
        uncalibrated={projected.uncalibrated}
      />

      {/* Timeline header */}
      <div>
        <h3 className="text-base font-semibold text-deep-navy mb-1">
          Your Top 3 Learning Steps
        </h3>
        <p className="text-xs text-gray-500">
          Ranked by projected gain per effort-week. Completing all three drives
          the estimated readiness above.
        </p>
      </div>

      {/* Steps — vertical on phone, horizontal on md+ */}
      <div className="md:grid md:grid-cols-3 md:gap-8 space-y-6 md:space-y-0">
        {projected.topSteps.map((step, i) => (
          <motion.div
            key={step.stepOrder}
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            <StepCard
              step={step}
              index={i}
              isLast={i === projected.topSteps.length - 1}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
