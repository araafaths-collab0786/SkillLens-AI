/**
 * /dashboard — Full Dashboard Page (Phase 6)
 *
 * Sections:
 *  1. Time-of-day greeting with user's name
 *  2. Readiness Index card (animated counter) — latest match
 *  3. Top 3 skill gaps summary
 *  4. Active learning steps with progress checkboxes
 *  5. Recent resume submissions with status badges
 *
 * Responsive:
 *  - 1 column on phones
 *  - 2 columns on tablets (md)
 *  - Grid on desktop (lg: sidebar-style with main content area)
 *
 * Skeleton loaders on every fetch.
 * Empty states with next-step CTAs.
 * Error boundaries on each section.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileText,
  BarChart2,
  BookOpen,
  Camera,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { RadialGauge } from "@/components/RadialGauge";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/cn";
import { dashboardApi, authApi, ApiClientError } from "@skilllens/shared/api-client";
import type { DashboardData } from "@skilllens/shared/api-client";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-gray-200", className)} />
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-8 w-3/5" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  synced:       { label: "Synced",       cls: "bg-green-50  text-green-700  border-green-200"  },
  pending:      { label: "Pending",      cls: "bg-gray-50   text-gray-600   border-gray-200"   },
  processing:   { label: "Processing",   cls: "bg-blue-50   text-blue-700   border-blue-200"   },
  needs_review: { label: "Needs Review", cls: "bg-amber-50  text-amber-700  border-amber-200"  },
  error:        { label: "Error",        cls: "bg-red-50    text-red-700    border-red-200"    },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", s.cls)}>
      {s.label}
    </span>
  );
}

// ── Severity badge ─────────────────────────────────────────────────────────────

const SEV_STYLES: Record<string, string> = {
  High:   "bg-red-50   text-red-700   border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low:    "bg-blue-50  text-blue-600  border-blue-200",
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border shrink-0", SEV_STYLES[severity] ?? SEV_STYLES.Low)}>
      {severity}
    </span>
  );
}

// ── Greeting ──────────────────────────────────────────────────────────────────

function greeting(name: string): string {
  const h = new Date().getHours();
  const salutation = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${salutation}, ${name.split(" ")[0]}`;
}

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedCounter({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) { setDisplayed(value); return; }
    let start: number | null = null;
    const duration = 900;
    const step = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(value * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);

  return <>{displayed}</>;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center" aria-hidden="true">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <div>
        <p className="font-semibold text-deep-navy text-sm">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5 max-w-xs mx-auto">{body}</p>
      </div>
      <button
        type="button"
        onClick={() => router.push(href)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text rounded min-h-[44px]"
      >
        {cta} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white overflow-hidden", className)}>
      {title && (
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-deep-navy">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("there");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepsDone, setStepsDone] = useState<Record<number, boolean>>({});

  const loadDashboard = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      dashboardApi.get(),
      authApi.me(),
    ])
      .then(([dashEnv, meEnv]) => {
        setData(dashEnv.data ?? null);
        if (meEnv.data?.user?.fullName) {
          setUserName(meEnv.data.user.fullName);
        }
      })
      .catch((e) => {
        if (e instanceof ApiClientError && e.status === 401) {
          router.push("/login?next=/dashboard");
          return;
        }
        setError(e instanceof ApiClientError ? e.message : "Failed to load dashboard.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Format date for display
  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-white-mist pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

          {/* ── Greeting ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-deep-navy">
              {greeting(userName)} 👋
            </h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base">
              Here's your skills snapshot.
            </p>
          </motion.div>

          {/* ── Error state ── */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-6">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={loadDashboard}
                className="shrink-0 p-1 rounded hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                aria-label="Retry"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* ── Loading skeletons ── */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* ── Dashboard content ── */}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* ── Readiness Index card ── */}
              <ErrorBoundary>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0 }}
                  className="md:col-span-1"
                >
                  <Card title="Readiness Index">
                    {data?.readinessIndex != null ? (
                      <div className="p-5 flex flex-col items-center gap-4">
                        <RadialGauge
                          value={data.readinessIndex}
                          size={140}
                          label="Readiness"
                          sublabel={data.jobTitle ?? "Latest match"}
                        />
                        <div className="flex gap-2 w-full">
                          <button
                            type="button"
                            onClick={() =>
                              data.resumeId && data.jobId &&
                              router.push(`/match?resumeId=${data.resumeId}`)
                            }
                            className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 text-deep-navy hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text transition-colors duration-200 min-h-[44px]"
                          >
                            View Match
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              data.resumeId && data.jobId &&
                              router.push(`/gap-analysis?resumeId=${data.resumeId}&jobId=${data.jobId}`)
                            }
                            className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-cyan text-deep-navy hover:bg-cyan/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text transition-colors duration-200 min-h-[44px]"
                          >
                            View Gaps
                          </button>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon={BarChart2}
                        title="No match yet"
                        body="Upload a resume and match it to a job to see your Readiness Index."
                        cta="Upload resume"
                        href="/resume"
                      />
                    )}
                  </Card>
                </motion.div>
              </ErrorBoundary>

              {/* ── Top 3 Gaps ── */}
              <ErrorBoundary>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.06 }}
                >
                  <Card title="Top Skill Gaps">
                    {data?.topGaps && data.topGaps.length > 0 ? (
                      <ul className="divide-y divide-gray-100" role="list">
                        {data.topGaps.map((gap, i) => (
                          <li
                            key={`${gap.label}-${i}`}
                            className="flex items-center justify-between gap-3 px-5 py-3.5"
                          >
                            <span className="text-sm text-deep-navy font-medium truncate">
                              {gap.label}
                            </span>
                            <SeverityBadge severity={gap.severity} />
                          </li>
                        ))}
                        <li className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              data.resumeId && data.jobId &&
                              router.push(`/gap-analysis?resumeId=${data.resumeId}&jobId=${data.jobId}`)
                            }
                            className="text-xs font-medium text-cyan-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text rounded"
                          >
                            See full gap analysis →
                          </button>
                        </li>
                      </ul>
                    ) : (
                      <EmptyState
                        icon={BarChart2}
                        title="No gaps analyzed yet"
                        body="Run a gap analysis to see which skills to work on."
                        cta="Go to Match"
                        href="/match"
                      />
                    )}
                  </Card>
                </motion.div>
              </ErrorBoundary>

              {/* ── Active Learning Steps ── */}
              <ErrorBoundary>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.12 }}
                >
                  <Card title="Active Learning Steps">
                    {data?.activeSteps && data.activeSteps.length > 0 ? (
                      <ul className="divide-y divide-gray-100" role="list">
                        {data.activeSteps.map((step, i) => (
                          <li
                            key={`${step.escoLabel}-${i}`}
                            className="flex items-start gap-3 px-5 py-3.5"
                          >
                            <label className="flex items-center gap-3 cursor-pointer min-h-[44px] w-full">
                              <input
                                type="checkbox"
                                checked={!!stepsDone[i]}
                                onChange={(e) =>
                                  setStepsDone((prev) => ({
                                    ...prev,
                                    [i]: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 rounded border-gray-300 accent-cyan focus:ring-2 focus:ring-cyan-text shrink-0"
                                aria-label={`Mark "${step.escoLabel}" as done`}
                              />
                              <div className="flex-1 min-w-0">
                                <p
                                  className={cn(
                                    "text-sm font-medium text-deep-navy leading-tight",
                                    stepsDone[i] && "line-through text-gray-400"
                                  )}
                                >
                                  {step.escoLabel}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {step.effortWeeks}w effort ·{" "}
                                  <span className="text-cyan-text font-medium">
                                    +{step.gainDelta.toFixed(1)} pts
                                  </span>
                                </p>
                              </div>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState
                        icon={BookOpen}
                        title="No learning steps yet"
                        body="Complete a gap analysis to get your personalized learning path."
                        cta="Analyze gaps"
                        href="/gap-analysis"
                      />
                    )}
                  </Card>
                </motion.div>
              </ErrorBoundary>

              {/* ── Recent Submissions ── (spans full width on md+) */}
              <ErrorBoundary>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.18 }}
                  className="md:col-span-2 lg:col-span-3"
                >
                  <Card title="Recent Resume Submissions">
                    {data?.recentResumes && data.recentResumes.length > 0 ? (
                      <>
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  Method
                                </th>
                                <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  Date
                                </th>
                                <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  Skills Found
                                </th>
                                <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  Status
                                </th>
                                <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.recentResumes.map((r) => (
                                <tr
                                  key={r.id}
                                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150"
                                >
                                  <td className="py-3 px-5 text-sm text-deep-navy">
                                    <span className="flex items-center gap-1.5">
                                      {r.intakeMethod === "camera_capture" ? (
                                        <Camera className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                                      ) : (
                                        <FileText className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                                      )}
                                      {r.intakeMethod === "camera_capture" ? "Camera" : "Upload"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-5 text-sm text-gray-500">
                                    {formatDate(r.createdAt)}
                                  </td>
                                  <td className="py-3 px-5 text-sm text-deep-navy">
                                    {r.skillCount}
                                  </td>
                                  <td className="py-3 px-5">
                                    <StatusBadge status={r.status} />
                                  </td>
                                  <td className="py-3 px-5">
                                    <button
                                      type="button"
                                      onClick={() => router.push(`/match?resumeId=${r.id}`)}
                                      className="text-xs font-medium text-cyan-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text rounded min-h-[44px]"
                                    >
                                      Match →
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile stacked cards */}
                        <div className="sm:hidden divide-y divide-gray-100">
                          {data.recentResumes.map((r) => (
                            <div key={r.id} className="px-5 py-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-sm font-medium text-deep-navy">
                                  {r.intakeMethod === "camera_capture" ? (
                                    <Camera className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                                  )}
                                  {r.intakeMethod === "camera_capture" ? "Camera Scan" : "PDF Upload"}
                                </span>
                                <StatusBadge status={r.status} />
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  {formatDate(r.createdAt)}
                                </span>
                                <span>{r.skillCount} skills</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => router.push(`/match?resumeId=${r.id}`)}
                                className="text-xs font-medium text-cyan-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text rounded min-h-[44px] flex items-center"
                              >
                                Match this resume →
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        icon={FileText}
                        title="No resumes submitted yet"
                        body="Upload a PDF or scan a printed resume to get started."
                        cta="Upload or scan a resume"
                        href="/resume"
                      />
                    )}

                    {/* Footer CTA */}
                    {data?.recentResumes && data.recentResumes.length > 0 && (
                      <div className="px-5 py-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => router.push("/resume")}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg bg-cyan px-4 py-2 text-deep-navy hover:bg-cyan/90 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text min-h-[44px]"
                        >
                          <FileText className="h-4 w-4" aria-hidden="true" />
                          Submit another resume
                        </button>
                      </div>
                    )}
                  </Card>
                </motion.div>
              </ErrorBoundary>

            </div>
          )}
        </div>
      </main>
    </>
  );
}
