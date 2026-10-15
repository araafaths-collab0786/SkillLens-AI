/**
 * SkillLens AI — Shared Zod Schemas and TypeScript Types
 *
 * All types used by the frontend and (for request/response typing)
 * by the TypeScript API client live here.
 *
 * Evidence levels, scoring constants, and UNCALIBRATED semantic thresholds
 * are documented here as the single source of truth for the shared layer.
 * The canonical computation lives in apps/api/app/scoring/.
 */

import { z } from "zod";

// ── Evidence levels ───────────────────────────────────────────────────────────

/**
 * Evidence levels (Section 7).
 * 3 = Verified, 2 = Demonstrated, 1 = Claimed, 0 = Absent.
 *
 * What each level establishes (shown in UI):
 * - Verified (3): Supported by a checkable artifact (public repo URL resolves,
 *   or certificate ID passes format validation). Does NOT prove authenticity.
 * - Demonstrated (2): Project/experience describes the skill with a concrete
 *   stated outcome. Self-described, not checked.
 * - Claimed (1): Skill listed without supporting context. Self-described only.
 * - Absent (0): No evidence found.
 *
 * Multipliers (e_i):
 *   Verified → 1.0 | Demonstrated → 0.85 | Claimed → 0.6 | Absent → 0.0
 */
export const EvidenceLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  3: "Verified",
  2: "Demonstrated",
  1: "Claimed",
  0: "Absent",
};

export const EVIDENCE_MULTIPLIERS: Record<EvidenceLevel, number> = {
  3: 1.0,
  2: 0.85,
  1: 0.6,
  0: 0.0,
};

/**
 * UNCALIBRATED semantic match strength thresholds (Section 7).
 * These values are PROPOSED and UNCALIBRATED.
 * Every score that depends on a semantic match carries uncalibrated: true.
 * Do not change any threshold without written approval (Gate 3).
 */
export const SEMANTIC_THRESHOLDS_UNCALIBRATED = {
  /** cosine ≥ 0.92 → s = 0.95 */
  HIGH: { minCosine: 0.92, strength: 0.95 },
  /** 0.85 ≤ cosine < 0.92 → s = 0.85 */
  MED: { minCosine: 0.85, strength: 0.85 },
  /** 0.78 ≤ cosine < 0.85 → s = 0.70 */
  LOW: { minCosine: 0.78, strength: 0.70 },
  /** cosine < 0.78 → s = 0 (no match) */
  NONE: { minCosine: 0, strength: 0.0 },
} as const;

// ── Job weights ───────────────────────────────────────────────────────────────

export const JobWeightSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type JobWeight = z.infer<typeof JobWeightSchema>;

// ── ESCO mapping ──────────────────────────────────────────────────────────────

export const EscoMappingSchema = z.object({
  /** ESCO URI or local ID */
  escoId: z.string(),
  /** Canonical ESCO label */
  label: z.string(),
  /** The alias matched (synonym, abbreviation, or original text) */
  matchedAlias: z.string(),
  /** "exact" = alias index hit; "semantic" = sentence-transformer match */
  matchType: z.enum(["exact", "semantic"]),
  /** Cosine similarity (only set when matchType = "semantic") */
  cosineSimilarity: z.number().min(0).max(1).optional(),
  /** UNCALIBRATED flag — true when matchType = "semantic" */
  uncalibrated: z.boolean(),
});
export type EscoMapping = z.infer<typeof EscoMappingSchema>;

// ── Skill (parsed from resume) ────────────────────────────────────────────────

export const ParsedSkillSchema = z.object({
  id: z.string().uuid(),
  rawText: z.string(),
  escoMapping: EscoMappingSchema.nullable(),
  evidenceLevel: EvidenceLevelSchema,
  evidenceMultiplier: z.number(),
  /** Section of the resume where the skill was found */
  sourceSection: z.enum(["Experience", "Projects", "Education", "Certifications", "Skills", "Other"]),
  /** Verbatim snippet from the resume that supported this skill */
  sourceSnippet: z.string().optional(),
});
export type ParsedSkill = z.infer<typeof ParsedSkillSchema>;

// ── Resume ────────────────────────────────────────────────────────────────────

export const IntakeMethodSchema = z.enum(["pdf_upload", "camera_capture"]);
export type IntakeMethod = z.infer<typeof IntakeMethodSchema>;

export const ResumeStatusSchema = z.enum(["pending", "processing", "synced", "needs_review", "error"]);
export type ResumeStatus = z.infer<typeof ResumeStatusSchema>;

export const ScreeningStepResultSchema = z.object({
  step: z.string(),
  status: z.enum(["passed", "warning", "failed"]),
  flags: z.array(z.string()),
  metrics: z.record(z.unknown()),
});
export type ScreeningStepResult = z.infer<typeof ScreeningStepResultSchema>;

export const ParsedResumeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  submissionId: z.string().uuid(),  // client-generated idempotency key
  intakeMethod: IntakeMethodSchema,
  status: ResumeStatusSchema,
  skills: z.array(ParsedSkillSchema),
  screeningReport: z.array(ScreeningStepResultSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Disclaimer always shown in UI */
  disclaimer: z.literal(
    "This screening checks document quality and consistency. It does not confirm that the document or its claims are genuine."
  ),
});
export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

// ── Job ───────────────────────────────────────────────────────────────────────

export const JobCategorySchema = z.enum([
  "information_technology",
  "data_analytics",
  "healthcare_support",
  "logistics",
  "skilled_trades",
  "other",
]);
export type JobCategory = z.infer<typeof JobCategorySchema>;

export const RequiredSkillSchema = z.object({
  escoId: z.string(),
  label: z.string(),
  weight: JobWeightSchema,
});
export type RequiredSkill = z.infer<typeof RequiredSkillSchema>;

export const JobSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: JobCategorySchema,
  requiredSkills: z.array(RequiredSkillSchema),
  /** Nice-to-have skills have no weight and do not affect the score */
  niceToHaveSkills: z.array(z.object({ escoId: z.string(), label: z.string() })),
  sdgAligned: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Job = z.infer<typeof JobSchema>;

// ── Skill match result (per skill in the match response) ─────────────────────

export const SkillMatchResultSchema = z.object({
  escoId: z.string(),
  label: z.string(),
  weight: JobWeightSchema,
  /** Semantic match strength s_i (0–1) */
  s: z.number().min(0).max(1),
  /** Evidence multiplier e_i */
  e: z.number().min(0).max(1),
  /** s_i × e_i × w_i (numerator contribution) */
  contribution: z.number(),
  /** True when s_i was derived from an uncalibrated semantic match */
  uncalibrated: z.boolean(),
  evidenceLevel: EvidenceLevelSchema,
  sourceSnippet: z.string().optional(),
});
export type SkillMatchResult = z.infer<typeof SkillMatchResultSchema>;

// ── Readiness / Match score ───────────────────────────────────────────────────

export const MatchScoreSchema = z.object({
  resumeId: z.string().uuid(),
  jobId: z.string().uuid(),
  /** Readiness Index 0–100, clamped and rounded */
  readinessIndex: z.number().int().min(0).max(100),
  /** True when any skill used an uncalibrated semantic match */
  uncalibrated: z.boolean(),
  skills: z.array(SkillMatchResultSchema),
});
export type MatchScore = z.infer<typeof MatchScoreSchema>;

// ── Gap severity ──────────────────────────────────────────────────────────────

export const GapSeveritySchema = z.enum(["High", "Medium", "Low"]);
export type GapSeverity = z.infer<typeof GapSeveritySchema>;

export const GapSchema = z.object({
  escoId: z.string(),
  label: z.string(),
  severity: GapSeveritySchema,
  weight: JobWeightSchema,
  s: z.number(),
  e: z.number(),
  /** Closest transferable skills via ESCO relations (shown in panel only) */
  transferableSkills: z.array(z.object({ escoId: z.string(), label: z.string() })),
  recommendation: z.object({
    type: z.enum(["course", "project", "certification"]),
    title: z.string(),
    effortWeeks: z.number().int().min(1),
    /** Evidence upgrade this step produces */
    targetEvidenceLevel: EvidenceLevelSchema,
    stepOrder: z.number().int(),
  }),
  uncalibrated: z.boolean(),
});
export type Gap = z.infer<typeof GapSchema>;

// ── Projected readiness ───────────────────────────────────────────────────────

export const ProjectedReadinessSchema = z.object({
  currentReadiness: z.number().int().min(0).max(100),
  projectedReadiness: z.number().int().min(0).max(100),
  /** Top 3 learning steps used in the projection */
  topSteps: z.array(
    z.object({
      stepOrder: z.number().int(),
      escoLabel: z.string(),
      gainDelta: z.number(),
      effortWeeks: z.number().int(),
      /** Gain per effort-week = gainDelta / effortWeeks */
      gainPerEffortWeek: z.number(),
    })
  ),
  uncalibrated: z.boolean(),
  /** Always shown in UI */
  disclaimer: z.literal(
    "Estimated. Assumes the steps are completed and evidence is submitted and checked. Does not predict hiring outcomes."
  ),
});
export type ProjectedReadiness = z.infer<typeof ProjectedReadinessSchema>;

// ── Gap analysis response ─────────────────────────────────────────────────────

export const GapAnalysisSchema = z.object({
  resumeId: z.string().uuid(),
  jobId: z.string().uuid(),
  gaps: z.array(GapSchema),
  transferableSkillsPanel: z.array(z.object({ escoId: z.string(), label: z.string() })),
  projectedReadiness: ProjectedReadinessSchema,
  uncalibrated: z.boolean(),
});
export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;

// ── Auth ──────────────────────────────────────────────────────────────────────

export const UserRoleSchema = z.enum(["job_seeker", "recruiter", "career_counselor"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const RegisterRequestSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(12).max(128),
  confirmPassword: z.string(),
  role: UserRoleSchema,
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// ── Offline queue (local only, IndexedDB) ─────────────────────────────────────

export const QueuedCaptureStatusSchema = z.enum([
  "captured",
  "queued",
  "uploading",
  "synced",
  "failed",
]);
export type QueuedCaptureStatus = z.infer<typeof QueuedCaptureStatusSchema>;

export const QueuedCaptureSchema = z.object({
  /** Client-generated UUID — used as idempotency key on upload */
  id: z.string().uuid(),
  intakeMethod: z.literal("camera_capture"),
  /** Crop corners as [x, y] pixel pairs: [topLeft, topRight, bottomRight, bottomLeft] */
  cropCorners: z.tuple([
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number()]),
  ]),
  status: QueuedCaptureStatusSchema,
  capturedAt: z.string().datetime(),
  retryCount: z.number().int().min(0),
  lastError: z.string().optional(),
  /** IndexedDB blob key — blob stored separately */
  blobKey: z.string(),
});
export type QueuedCapture = z.infer<typeof QueuedCaptureSchema>;
