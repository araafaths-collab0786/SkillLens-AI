/**
 * /gap-analysis — Gap Analysis page
 *
 * Requires: ?resumeId=<uuid>&jobId=<uuid> in the URL.
 *
 * Sections:
 *  1. Severity-sorted gap cards (High → Medium → Low), one column on phones.
 *  2. Transferable-skills panel.
 *  3. Learning-path timeline with animated projected readiness bar.
 *
 * All semantic matches labeled "Uncalibrated" per spec (Section 7).
 * Projection labeled "Estimated" — never claims guaranteed outcomes (Section 7).
 */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronLeft, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { GapCard } from "@/components/GapCard";
import { LearningTimeline } from "@/components/LearningTimeline";
import { matchApi, ApiClientError } from "@skilllens/shared/api-client";
import type { GapAnalysis, Gap } from "@skilllens/shared";
import { cn } from "@/lib/cn";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-gray-200 rounded-xl", className)} />
  );
}

function GapSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

// ── Severity section header ────────────────────────────────────────────────────

function SeveritySection({
  severity,
  gaps,
}: {
  severity: "High" | "Medium" | "Low";
  gaps: Gap[];
}) {
  if (gaps.length === 0) return null;

  const headerStyles = {
    High: "text-red-700",
    Medium: "text-amber-700",
    Low: "text-blue-700",
  };

  return (
    <section aria-label={`${severity} severity gaps`}>
      <h3
        className={cn(
          "text-sm font-semibold uppercase tracking-wide mb-3",
          headerStyles[severity]
        )}
      >
        {severity} Priority · {gaps.length} gap{gaps.length !== 1 ? "s" : ""}
      </h3>
      <div className="space-y-3">
        {gaps.map((gap, i) => (
          <motion.div
            key={gap.escoId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
          >
            <GapCard gap={gap} stepNumber={gap.recommendation.stepOrder} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── Transferable skills panel ──────────────────────────────────────────────────

function TransferablePanel({
  skills,
}: {
  skills: { escoId: string; label: string }[];
}) {
  if (skills.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 space-y-3"
      aria-label="Transferable skills"
    >
      <div>
        <h3 className="text-base font-semibold text-deep-navy">
          Transferable Skills
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Skills you already have that are related to required skills via ESCO
          relations. They do not count toward your score but may help you learn
          faster.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span
            key={s.escoId}
            className="text-sm px-3 py-1 rounded-full bg-cyan/10 text-cyan-text border border-cyan/20 font-medium"
          >
            {s.label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GapAnalysisPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const resumeId = searchParams.get("resumeId") ?? "";
  const jobId = searchParams.get("jobId") ?? "";

  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!resumeId || !jobId) {
      setError("Missing resumeId or jobId. Please start from the Match page.");
      return;
    }
    setLoading(true);
    setError(null);
    matchApi
      .gapAnalysis(resumeId, jobId)
      .then((env) => setAnalysis(env.data ?? null))
      .catch((e) => {
        setError(
          e instanceof ApiClientError ? e.message : "Gap analysis failed."
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, jobId]);

  // Sort gaps by severity order: High → Medium → Low
  const highGaps = analysis?.gaps.filter((g) => g.severity === "High") ?? [];
  const medGaps = analysis?.gaps.filter((g) => g.severity === "Medium") ?? [];
  const lowGaps = analysis?.gaps.filter((g) => g.severity === "Low") ?? [];
  const totalGaps = highGaps.length + medGaps.length + lowGaps.length;

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-white-mist pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            {/* Back button */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  resumeId && jobId
                    ? `/match?resumeId=${resumeId}`
                    : "/match"
                )
              }
              className="flex items-center gap-1.5 text-sm text-cyan-text mb-4 min-h-[44px]
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text rounded"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back to Match
            </button>

            <h1 className="text-2xl sm:text-3xl font-bold text-deep-navy">
              Skill Gap Analysis
            </h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base">
              See exactly which skills separate you from this role and what to
              learn next.
            </p>
          </motion.div>

          {/* Missing params warning */}
          {(!resumeId || !jobId) && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                No resume or job selected.{" "}
                <button
                  type="button"
                  onClick={() => router.push("/match")}
                  className="underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text"
                >
                  Go to Match page
                </button>
              </span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-6">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={load}
                className="shrink-0 p-1 rounded hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                aria-label="Retry"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-6">
              <GapSkeleton />
              <Skeleton className="h-40" />
              <Skeleton className="h-64" />
            </div>
          )}

          {/* Results */}
          <AnimatePresence>
            {analysis && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-10"
              >
                {/* Uncalibrated notice */}
                {analysis.uncalibrated && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    This analysis includes uncalibrated semantic similarity scores
                    (UNCALIBRATED — thresholds are proposed, not validated).
                    Results labeled "Uncalibrated" should be treated as estimates.
                  </div>
                )}

                {/* ── Gap cards section ── */}
                <section aria-label="Skill gaps">
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-lg font-semibold text-deep-navy">
                      Skill Gaps
                    </h2>
                    <p className="text-xs text-gray-400">
                      {totalGaps} gap{totalGaps !== 1 ? "s" : ""} identified
                    </p>
                  </div>

                  {totalGaps === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                      <p className="text-2xl mb-2" aria-hidden="true">🎉</p>
                      <p className="font-semibold text-deep-navy">
                        No significant gaps found!
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Your skills closely match this role's requirements.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <SeveritySection severity="High" gaps={highGaps} />
                      <SeveritySection severity="Medium" gaps={medGaps} />
                      <SeveritySection severity="Low" gaps={lowGaps} />
                    </div>
                  )}
                </section>

                {/* ── Transferable skills panel ── */}
                <TransferablePanel skills={analysis.transferableSkillsPanel} />

                {/* ── Learning-path timeline ── */}
                {analysis.projectedReadiness.topSteps.length > 0 && (
                  <section aria-label="Learning path and projected readiness">
                    <h2 className="text-lg font-semibold text-deep-navy mb-4">
                      Your Learning Path
                    </h2>
                    <LearningTimeline projected={analysis.projectedReadiness} />
                  </section>
                )}

                {/* Disclaimer footer */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 space-y-1">
                  <p>
                    <strong>Screening disclaimer:</strong> This analysis checks
                    document quality and skill consistency. It does not confirm
                    that the document or its claims are genuine.
                  </p>
                  <p>
                    <strong>Projection disclaimer:</strong>{" "}
                    {analysis.projectedReadiness.disclaimer}
                  </p>
                  {analysis.uncalibrated && (
                    <p>
                      <strong>Calibration status:</strong> Semantic match
                      thresholds are UNCALIBRATED. Accuracy on real, unseen
                      resumes is unknown. See README for methodology.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
