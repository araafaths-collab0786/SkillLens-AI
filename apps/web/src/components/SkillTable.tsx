/**
 * SkillTable — displays per-skill match results.
 *
 * On phones (< md) each skill renders as a stacked card with labeled fields.
 * On md+ it renders as a proper table.
 *
 * Each row shows: skill label, weight (w), semantic strength (s), evidence (e),
 * contribution, uncalibrated flag, and evidence level label.
 */
"use client";

import { cn } from "@/lib/cn";
import type { SkillMatchResult } from "@skilllens/shared";
import { EVIDENCE_LABELS, type EvidenceLevel } from "@skilllens/shared";

interface SkillTableProps {
  skills: SkillMatchResult[];
  className?: string;
}

const WEIGHT_LABELS: Record<1 | 2 | 3, string> = {
  1: "Nice to have",
  2: "Important",
  3: "Critical",
};

const WEIGHT_BADGE: Record<1 | 2 | 3, string> = {
  1: "bg-gray-100 text-gray-600",
  2: "bg-blue-50 text-blue-700",
  3: "bg-red-50 text-red-700",
};

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

interface ExpandableRowProps {
  skill: SkillMatchResult;
}

function ExpandableRow({ skill }: ExpandableRowProps) {
  return (
    <>
      {/* Desktop table row */}
      <tr className="hidden md:table-row border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
        <td className="py-3 px-4 text-sm font-medium text-deep-navy">
          {skill.label}
          {skill.uncalibrated && (
            <span className="ml-2 text-xs text-amber-600 font-normal">
              Uncalibrated
            </span>
          )}
        </td>
        <td className="py-3 px-4">
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              WEIGHT_BADGE[skill.weight]
            )}
          >
            {WEIGHT_LABELS[skill.weight]} (w={skill.weight})
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-center text-deep-navy">
          {pct(skill.s)}
        </td>
        <td className="py-3 px-4 text-sm text-center text-deep-navy">
          {pct(skill.e)}
          <span className="ml-1 text-xs text-gray-400">
            ({EVIDENCE_LABELS[skill.evidenceLevel]})
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-center font-semibold text-cyan-text">
          {skill.contribution.toFixed(2)}
        </td>
        {skill.sourceSnippet && (
          <td className="py-3 px-4 text-xs text-gray-400 max-w-xs truncate" title={skill.sourceSnippet}>
            {skill.sourceSnippet}
          </td>
        )}
      </tr>

      {/* Mobile stacked card */}
      <div className="md:hidden rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-deep-navy text-sm">{skill.label}</p>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
              WEIGHT_BADGE[skill.weight]
            )}
          >
            w={skill.weight}
          </span>
        </div>
        {skill.uncalibrated && (
          <p className="text-xs text-amber-600">⚠ Uncalibrated similarity match</p>
        )}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-400">Match (s)</p>
            <p className="font-medium text-deep-navy">{pct(skill.s)}</p>
          </div>
          <div>
            <p className="text-gray-400">Evidence (e)</p>
            <p className="font-medium text-deep-navy">{pct(skill.e)}</p>
          </div>
          <div>
            <p className="text-gray-400">Contribution</p>
            <p className="font-semibold text-cyan-text">{skill.contribution.toFixed(2)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          {EVIDENCE_LABELS[skill.evidenceLevel]}
          {skill.sourceSnippet && ` · "${skill.sourceSnippet}"`}
        </p>
      </div>
    </>
  );
}

export function SkillTable({ skills, className }: SkillTableProps) {
  if (skills.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No skills to display.
      </p>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Skill
              </th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Weight
              </th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                Match (s)
              </th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                Evidence (e)
              </th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                Contribution
              </th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Snippet
              </th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => (
              <ExpandableRow key={skill.escoId} skill={skill} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-3">
        {skills.map((skill) => (
          <ExpandableRow key={skill.escoId} skill={skill} />
        ))}
      </div>
    </div>
  );
}
