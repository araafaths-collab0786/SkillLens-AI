/**
 * /match — Job Match page
 *
 * Flow:
 *  1. User selects a resume (passed via ?resumeId= or from localStorage fallback).
 *  2. Searchable job selector with category chips.
 *  3. On job selection → POST /api/v1/match → animated Readiness Index gauge.
 *  4. Skill-by-skill table (desktop) / stacked cards (phone).
 *  5. "Analyze gaps →" CTA to /gap-analysis?resumeId=X&jobId=Y
 *
 * Semantic matches are labeled "Uncalibrated similarity match" per spec.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { RadialGauge } from "@/components/RadialGauge";
import { SkillTable } from "@/components/SkillTable";
import { cn } from "@/lib/cn";
import { jobsApi, matchApi, ApiClientError } from "@skilllens/shared/api-client";
import type { Job, MatchScore, JobCategory } from "@skilllens/shared";

// ── Category display labels ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<JobCategory | "all", string> = {
  all: "All",
  information_technology: "IT",
  data_analytics: "Data & Analytics",
  healthcare_support: "Healthcare",
  logistics: "Logistics",
  skilled_trades: "Skilled Trades",
  other: "Other",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as (JobCategory | "all")[];

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-gray-200 rounded-lg", className)} />
  );
}

function GaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <Skeleton className="w-40 h-40 rounded-full" />
      <Skeleton className="w-32 h-4" />
      <Skeleton className="w-24 h-3" />
    </div>
  );
}

// ── Job selector chip ──────────────────────────────────────────────────────────

interface JobChipProps {
  job: Job;
  selected: boolean;
  onSelect: () => void;
}

function JobChip({ job, selected, onSelect }: JobChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-xl border p-4 transition-all duration-200 w-full min-h-[44px]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text",
        selected
          ? "border-cyan bg-cyan/10 shadow-sm"
          : "border-gray-200 bg-white hover:border-cyan/50 hover:bg-gray-50"
      )}
    >
      <p className="text-sm font-semibold text-deep-navy leading-tight">
        {job.title}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">
        {CATEGORY_LABELS[job.category] ?? job.category}
        {job.sdgAligned && (
          <span className="ml-2 text-cyan-text font-medium">SDG 8</span>
        )}
      </p>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MatchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const resumeId = searchParams.get("resumeId") ?? "";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<JobCategory | "all">("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<MatchScore | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load jobs on mount
  useEffect(() => {
    setLoadingJobs(true);
    jobsApi
      .list()
      .then((env) => {
        setJobs(env.data?.jobs ?? []);
      })
      .catch((e) => {
        setError(e instanceof ApiClientError ? e.message : "Failed to load jobs.");
      })
      .finally(() => setLoadingJobs(false));
  }, []);

  // Filter jobs when search or category changes
  useEffect(() => {
    let result = jobs;
    if (activeCategory !== "all") {
      result = result.filter((j) => j.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((j) => j.title.toLowerCase().includes(q));
    }
    setFilteredJobs(result);
  }, [jobs, search, activeCategory]);

  // Run match when a job is selected
  const runMatch = useCallback(
    async (jobId: string) => {
      if (!resumeId) {
        setError("No resume selected. Please upload a resume first.");
        return;
      }
      setLoadingMatch(true);
      setMatchScore(null);
      setError(null);
      try {
        const env = await matchApi.match(resumeId, jobId);
        setMatchScore(env.data ?? null);
      } catch (e) {
        setError(
          e instanceof ApiClientError ? e.message : "Match calculation failed."
        );
      } finally {
        setLoadingMatch(false);
      }
    },
    [resumeId]
  );

  function handleSelectJob(jobId: string) {
    setSelectedJobId(jobId);
    void runMatch(jobId);
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-white-mist pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-deep-navy">
              Job Match
            </h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base">
              Select a target role to see your Readiness Index and skill-by-skill
              breakdown.
            </p>
            {!resumeId && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  No resume linked.{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/resume")}
                    className="underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text"
                  >
                    Upload or scan a resume first.
                  </button>
                </span>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            {/* ── Left: Job selector ── */}
            <section aria-label="Job selector">
              {/* Search */}
              <div className="relative mb-4">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="Search roles…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm
                             text-deep-navy placeholder-gray-400
                             focus:outline-none focus:ring-2 focus:ring-cyan-text focus:border-transparent
                             transition-colors duration-200"
                  aria-label="Search job roles"
                />
              </div>

              {/* Category chips — horizontally scrollable on phones */}
              <div
                className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide md:flex-wrap md:overflow-visible"
                role="group"
                aria-label="Filter by category"
              >
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-200 min-h-[36px]",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text",
                      activeCategory === cat
                        ? "bg-cyan text-deep-navy border-cyan"
                        : "bg-white text-gray-600 border-gray-200 hover:border-cyan/50"
                    )}
                    aria-pressed={activeCategory === cat}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              {/* Job list */}
              {loadingJobs ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : filteredJobs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">
                  No roles match your search.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AnimatePresence>
                    {filteredJobs.map((job, i) => (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                      >
                        <JobChip
                          job={job}
                          selected={job.id === selectedJobId}
                          onSelect={() => handleSelectJob(job.id)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* ── Right: Gauge + results ── */}
            <section
              aria-label="Match results"
              aria-live="polite"
              aria-busy={loadingMatch}
            >
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                {loadingMatch ? (
                  <GaugeSkeleton />
                ) : matchScore ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={matchScore.jobId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="p-6 space-y-6"
                    >
                      {/* Gauge — headline feature */}
                      <div className="flex flex-col items-center gap-2">
                        <RadialGauge
                          value={matchScore.readinessIndex}
                          size={160}
                          label="Readiness Index"
                          sublabel={selectedJob?.title ?? ""}
                          uncalibrated={matchScore.uncalibrated}
                        />
                        {matchScore.uncalibrated && (
                          <p className="text-xs text-gray-400 text-center max-w-xs">
                            Some skills were matched using uncalibrated semantic
                            similarity. Results may vary.
                          </p>
                        )}
                      </div>

                      {/* CTA to gap analysis */}
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/gap-analysis?resumeId=${resumeId}&jobId=${matchScore.jobId}`
                          )
                        }
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                                   bg-cyan text-deep-navy font-semibold text-sm
                                   hover:bg-cyan/90 transition-colors duration-200
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text"
                      >
                        Analyze skill gaps
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>

                      {/* Nice-to-have skills */}
                      {selectedJob && selectedJob.niceToHaveSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Nice-to-have (not scored)
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedJob.niceToHaveSkills.map((s) => (
                              <span
                                key={s.escoId}
                                className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                              >
                                {s.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                    <div
                      className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <Search className="h-7 w-7 text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400">
                      Select a role on the left to see your Readiness Index.
                    </p>
                  </div>
                )}

                {/* Error state */}
                {error && (
                  <div className="mx-6 mb-6 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => selectedJobId && void runMatch(selectedJobId)}
                      className="ml-auto shrink-0 p-1 rounded hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      aria-label="Retry"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ── Skill breakdown table ── */}
          <AnimatePresence>
            {matchScore && (
              <motion.section
                key="skill-table"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mt-8"
                aria-label="Skill-by-skill breakdown"
              >
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-lg font-semibold text-deep-navy">
                    Skill-by-Skill Breakdown
                  </h2>
                  <p className="text-xs text-gray-400">
                    {matchScore.skills.length} required skill
                    {matchScore.skills.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {matchScore.uncalibrated && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Skills marked "Uncalibrated" used semantic similarity matching
                    (UNCALIBRATED — thresholds are proposed, not validated).
                  </div>
                )}

                <SkillTable skills={matchScore.skills} />

                {/* Formula disclosure */}
                <details className="mt-4">
                  <summary className="text-xs text-cyan-text cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text rounded">
                    How is the Readiness Index calculated?
                  </summary>
                  <div className="mt-2 rounded-xl bg-gray-50 border border-gray-200 p-4 text-xs text-gray-600 space-y-2">
                    <p>
                      <strong>Readiness = 100 × Σ(s × e × w) / Σw</strong>
                    </p>
                    <p>
                      <strong>s</strong> = semantic match strength (1.0 for exact
                      ESCO match; stepped table for cosine similarity —
                      UNCALIBRATED).
                    </p>
                    <p>
                      <strong>e</strong> = evidence multiplier (Verified 1.0,
                      Demonstrated 0.85, Claimed 0.6, Absent 0).
                    </p>
                    <p>
                      <strong>w</strong> = job-defined weight (1 = nice-to-have,
                      2 = important, 3 = critical).
                    </p>
                    <p className="text-gray-400">
                      Semantic match thresholds are UNCALIBRATED (proposed,
                      not validated on real data). See README for details.
                    </p>
                  </div>
                </details>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
