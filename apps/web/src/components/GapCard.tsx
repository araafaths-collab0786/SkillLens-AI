/**
 * GapCard — displays a single skill gap with severity badge, s/e values,
 * transferable-skills list, and the recommended learning step.
 *
 * Used on /gap-analysis. Stack of these cards, sorted by severity (High → Low).
 */
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Gap, EvidenceLevel } from "@skilllens/shared";
import { EVIDENCE_LABELS } from "@skilllens/shared";

/** Map the float e_i back to the nearest evidence level label */
function evidenceLabelFromMultiplier(e: number): string {
  if (e >= 1.0) return EVIDENCE_LABELS[3];
  if (e >= 0.85) return EVIDENCE_LABELS[2];
  if (e >= 0.6) return EVIDENCE_LABELS[1];
  return EVIDENCE_LABELS[0];
}

interface GapCardProps {
  gap: Gap;
  stepNumber: number;
}

const SEVERITY_STYLES: Record<"High" | "Medium" | "Low", { badge: string; border: string }> = {
  High: {
    badge: "bg-red-100 text-red-700 border-red-200",
    border: "border-l-4 border-l-red-400",
  },
  Medium: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    border: "border-l-4 border-l-amber-400",
  },
  Low: {
    badge: "bg-blue-50 text-blue-600 border-blue-200",
    border: "border-l-4 border-l-blue-300",
  },
};

const REC_ICON: Record<string, string> = {
  course: "📚",
  project: "💻",
  certification: "🏆",
};

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

export function GapCard({ gap, stepNumber }: GapCardProps) {
  const [expanded, setExpanded] = useState(gap.severity === "High");
  const styles = SEVERITY_STYLES[gap.severity];

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white overflow-hidden transition-shadow duration-200 hover:shadow-md",
        styles.border
      )}
    >
      {/* Header — always visible */}
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={`gap-body-${gap.escoId}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-deep-navy truncate">
            {gap.label}
          </span>
          {gap.uncalibrated && (
            <span className="text-xs text-amber-600 shrink-0">Uncalibrated</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full border",
              styles.badge
            )}
          >
            {gap.severity}
          </span>
          <span className="text-xs text-gray-400">Step {stepNumber}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform duration-200",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Body — collapsible */}
      {expanded && (
        <div
          id={`gap-body-${gap.escoId}`}
          className="px-5 pb-5 space-y-4 border-t border-gray-100"
        >
          {/* s/e/w values */}
          <div className="grid grid-cols-3 gap-3 pt-3">
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Match (s)</p>
              <p className="text-base font-bold text-deep-navy">{pct(gap.s)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Evidence (e)</p>
              <p className="text-base font-bold text-deep-navy">{pct(gap.e)}</p>
              <p className="text-xs text-gray-400">{evidenceLabelFromMultiplier(gap.e)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Weight (w)</p>
              <p className="text-base font-bold text-deep-navy">{gap.weight}</p>
            </div>
          </div>

          {/* Transferable skills */}
          {gap.transferableSkills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Related skills you may already have
              </p>
              <div className="flex flex-wrap gap-1.5">
                {gap.transferableSkills.map((ts) => (
                  <span
                    key={ts.escoId}
                    className="text-xs px-2 py-0.5 rounded-full bg-cyan/10 text-cyan-text border border-cyan/20"
                  >
                    {ts.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                {REC_ICON[gap.recommendation.type] ?? "📖"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-deep-navy">
                  {gap.recommendation.title}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                  <span>
                    Type:{" "}
                    <span className="capitalize font-medium text-deep-navy">
                      {gap.recommendation.type}
                    </span>
                  </span>
                  <span>
                    Effort:{" "}
                    <span className="font-medium text-deep-navy">
                      {gap.recommendation.effortWeeks} week
                      {gap.recommendation.effortWeeks !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <span>
                    Upgrades evidence to:{" "}
                    <span className="font-medium text-deep-navy">
                      {EVIDENCE_LABELS[gap.recommendation.targetEvidenceLevel]}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
