/**
 * SkillLens AI — Design Tokens
 *
 * This file is the single source of truth for every colour pair used in the UI.
 * The CI contrast check (`scripts/check-contrast.ts`) reads this file,
 * computes WCAG 2.x relative luminance, and fails the build if any enforced
 * pair falls below its required threshold.
 *
 * APPROVAL STATUS
 * ───────────────
 * APPROVED  — token is fully approved for use in production components.
 * PROVISIONAL — token is defined but BLOCKED from use in components until:
 *               (a) the CI contrast report passes for every pair that uses it,
 *               (b) the token receives written approval (Gate 2).
 *               Replace it with Deep Navy in all roles until approved.
 *
 * WCAG THRESHOLDS
 * ───────────────
 * normalText    : 4.5 : 1  (body, labels, small text)
 * largeText     : 3.0 : 1  (headings ≥ 18 pt / 14 pt bold)
 * uiComponent   : 3.0 : 1  (borders, icons, non-text UI)
 * focusIndicator: 3.0 : 1  (focus ring against adjacent colour)
 */

// ── Base palette ─────────────────────────────────────────────────────────────

export const COLOR = {
  /** Primary page background */
  WHITE_MIST: "#F3F6F8",    // APPROVED
  /** Text only — headings, body, labels, text on Cyan buttons */
  DEEP_NAVY: "#0B1F3A",     // APPROVED
  /** Fills and accents — button backgrounds, progress fills, large icons */
  CYAN: "#06B6D4",          // APPROVED
  /**
   * APPROVED 2025-07-11 — for links, small accent text, and focus rings on
   * White Mist. Contrast verified at 4.94:1 (≥ 4.5:1 required).
   * See README § Decision Log, Gate 2.
   */
  CYAN_TEXT: "#0E7490",     // APPROVED — Gate 2 approved 2025-07-11
} as const;

export type ColorKey = keyof typeof COLOR;

// ── Contrast pairs ────────────────────────────────────────────────────────────
// Each entry defines a foreground / background pair plus the required threshold.
// The CI script enforces every pair flagged `enforced: true`.

export type ThresholdKey = "normalText" | "largeText" | "uiComponent" | "focusIndicator";

export interface ContrastPair {
  id: string;
  fg: string;
  bg: string;
  threshold: ThresholdKey;
  /** Minimum ratio required (derived from threshold key, listed for clarity) */
  minRatio: number;
  enforced: boolean;
  notes?: string;
}

export const CONTRAST_PAIRS: ContrastPair[] = [
  // ── Approved pairs ─────────────────────────────────────────────────────────
  {
    id: "deep-navy-on-white-mist",
    fg: COLOR.DEEP_NAVY,
    bg: COLOR.WHITE_MIST,
    threshold: "normalText",
    minRatio: 4.5,
    enforced: true,
    notes: "Primary text. Expected ~15:1.",
  },
  {
    id: "deep-navy-on-cyan",
    fg: COLOR.DEEP_NAVY,
    bg: COLOR.CYAN,
    threshold: "normalText",
    minRatio: 4.5,
    enforced: true,
    notes: "Text on primary (Cyan) buttons. Expected ~6.8:1.",
  },
  {
    id: "deep-navy-on-cyan-large",
    fg: COLOR.DEEP_NAVY,
    bg: COLOR.CYAN,
    threshold: "largeText",
    minRatio: 3.0,
    enforced: true,
    notes: "Large headings on Cyan. Expected ~6.8:1.",
  },
  {
    id: "white-on-cyan-BLOCKED",
    fg: "#FFFFFF",
    bg: COLOR.CYAN,
    threshold: "normalText",
    minRatio: 4.5,
    enforced: true,
    notes: "MUST FAIL — white on Cyan is ~2.4:1. Blocked in design system.",
  },
  {
    id: "cyan-on-white-mist-BLOCKED",
    fg: COLOR.CYAN,
    bg: COLOR.WHITE_MIST,
    threshold: "normalText",
    minRatio: 4.5,
    enforced: true,
    notes: "MUST FAIL — Cyan text on White Mist is ~2.2:1. Blocked for text.",
  },
  {
    id: "deep-navy-focus-on-white-mist",
    fg: COLOR.DEEP_NAVY,
    bg: COLOR.WHITE_MIST,
    threshold: "focusIndicator",
    minRatio: 3.0,
    enforced: true,
    notes: "Focus ring (Deep Navy) against White Mist background.",
  },
  {
    id: "cyan-border-on-white-mist",
    fg: COLOR.CYAN,
    bg: COLOR.WHITE_MIST,
    threshold: "uiComponent",
    minRatio: 3.0,
    enforced: false,  // NOT enforced — Cyan on White Mist is decorative-only (fills, not essential boundaries). Ratio ~2.2:1 is expected and documented.
    notes: "Cyan fill against White Mist. ~2.2:1. INTENTIONALLY below 3:1 threshold — used for decorative fills only (never for text or essential borders). Per design spec Section 4.",
  },
  // ── Cyan Text pairs — APPROVED 2025-07-11 (Gate 2) ────────────────────────
  {
    id: "cyan-text-on-white-mist",
    fg: COLOR.CYAN_TEXT,
    bg: COLOR.WHITE_MIST,
    threshold: "normalText",
    minRatio: 4.5,
    enforced: true,        // Gate 2 approved 2025-07-11
    notes: "Cyan Text #0E7490 on White Mist. Measured 4.94:1. Approved for links and small accent text.",
  },
  {
    id: "cyan-text-focus-on-white-mist",
    fg: COLOR.CYAN_TEXT,
    bg: COLOR.WHITE_MIST,
    threshold: "focusIndicator",
    minRatio: 3.0,
    enforced: true,        // Gate 2 approved 2025-07-11
    notes: "Cyan Text focus ring on White Mist. Measured 4.94:1. Approved for focus rings.",
  },
];

// ── Spacing grid ──────────────────────────────────────────────────────────────
/** All spacing values are multiples of 8 px */
export const SPACING = {
  1: "8px",
  2: "16px",
  3: "24px",
  4: "32px",
  5: "40px",
  6: "48px",
  8: "64px",
  10: "80px",
  12: "96px",
} as const;

// ── Typography ────────────────────────────────────────────────────────────────
export const FONT = {
  FAMILY: '-apple-system, "Segoe UI", system-ui, sans-serif',
  SIZE_BASE: "16px",     // minimum on phones to prevent iOS zoom
  LINE_HEIGHT: "1.6",
} as const;

// ── Motion ────────────────────────────────────────────────────────────────────
export const MOTION = {
  DURATION_FAST: "200ms",
  DURATION_MED: "300ms",
  EASING: "ease-out",
  STAGGER_MS: 80,
} as const;

// ── Border radius ─────────────────────────────────────────────────────────────
export const RADIUS = {
  CARD: "12px",   // rounded-xl equivalent
  BUTTON: "8px",  // rounded-lg
  INPUT: "6px",
} as const;
