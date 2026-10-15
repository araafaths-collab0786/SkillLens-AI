/**
 * SkillLens AI — Typed API Client
 *
 * All frontend API calls go through this client.
 * Every request and response is typed via /packages/shared/src/schemas.ts.
 *
 * The client wraps fetch, adds the CSRF header, and unwraps the
 * ApiEnvelope<T> response.
 */

import type { ApiEnvelope, ApiError } from "./api-envelope";
import type {
  RegisterRequest,
  LoginRequest,
  User,
  ParsedResume,
  MatchScore,
  GapAnalysis,
  Job,
} from "./schemas";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

// ── Helpers ───────────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  constructor(public readonly apiError: ApiError, public readonly status: number) {
    super(apiError.message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiEnvelope<T>> {
  const csrfToken =
    typeof document !== "undefined"
      ? document.cookie
          .split("; ")
          .find(row => row.startsWith("csrf_token="))
          ?.split("=")[1]
      : undefined;

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",  // send httpOnly cookies
  });

  const envelope: ApiEnvelope<T> = await res.json();

  if (!res.ok || envelope.error) {
    throw new ApiClientError(
      envelope.error ?? { code: "UNKNOWN", message: "Unknown error" },
      res.status
    );
  }

  return envelope;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: RegisterRequest) =>
    request<{ user: User }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: LoginRequest) =>
    request<{ user: User }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  refresh: () =>
    request<{ ok: true }>("/api/v1/auth/refresh", { method: "POST" }),

  logout: () =>
    request<{ ok: true }>("/api/v1/auth/logout", { method: "POST" }),

  me: () =>
    request<{ user: User }>("/api/v1/auth/me"),
};

// ── Resume endpoints ──────────────────────────────────────────────────────────

export const resumeApi = {
  upload: (formData: FormData) =>
    fetch(`${BASE_URL}/api/v1/resumes`, {
      method: "POST",
      body: formData,
      credentials: "include",
    }).then(r => r.json() as Promise<ApiEnvelope<ParsedResume>>),

  cameraCapture: (body: {
    submissionId: string;
    imageBase64: string;
    cropCorners: [[number, number], [number, number], [number, number], [number, number]];
  }) =>
    request<ParsedResume>("/api/v1/resumes", {
      method: "POST",
      body: JSON.stringify({ intake_method: "camera_capture", ...body }),
    }),

  detectDocument: (resumeId: string, imageBase64: string) =>
    request<{
      hints: string[];
      suggestedCorners: [[number, number], [number, number], [number, number], [number, number]] | null;
    }>(`/api/v1/resumes/${resumeId}/detect-document`, {
      method: "POST",
      body: JSON.stringify({ imageBase64 }),
    }),

  get: (id: string) =>
    request<ParsedResume>(`/api/v1/resumes/${id}`),

  delete: (id: string) =>
    request<{ ok: true }>(`/api/v1/resumes/${id}`, { method: "DELETE" }),
};

// ── Job endpoints ─────────────────────────────────────────────────────────────

export const jobsApi = {
  list: (params?: { category?: string; search?: string }) => {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return request<{ jobs: Job[] }>(`/api/v1/jobs${qs}`);
  },

  get: (id: string) =>
    request<Job>(`/api/v1/jobs/${id}`),
};

// ── Dashboard endpoint ────────────────────────────────────────────────────────

export interface DashboardData {
  latestResume: {
    id: string;
    intakeMethod: string;
    status: string;
    createdAt: string;
    skillCount: number;
  } | null;
  recentResumes: Array<{
    id: string;
    intakeMethod: string;
    status: string;
    createdAt: string;
    skillCount: number;
  }>;
  readinessIndex: number | null;
  jobTitle: string | null;
  topGaps: Array<{ label: string; severity: string; weight: number }>;
  activeSteps: Array<{
    escoLabel: string;
    effortWeeks: number;
    gainDelta: number;
    stepOrder: number;
  }>;
  resumeId: string | null;
  jobId: string | null;
}

export const dashboardApi = {
  get: () => request<DashboardData>("/api/v1/dashboard"),
};

// ── Match and gap endpoints ───────────────────────────────────────────────────

export const matchApi = {
  match: (resumeId: string, jobId: string) =>
    request<MatchScore>("/api/v1/match", {
      method: "POST",
      body: JSON.stringify({ resume_id: resumeId, job_id: jobId }),
    }),

  gapAnalysis: (resumeId: string, jobId: string) =>
    request<GapAnalysis>("/api/v1/gap-analysis", {
      method: "POST",
      body: JSON.stringify({ resume_id: resumeId, job_id: jobId }),
    }),
};
