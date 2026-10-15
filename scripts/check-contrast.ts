#!/usr/bin/env ts-node
/**
 * SkillLens AI — Automated WCAG 2.x Contrast Checker
 *
 * Usage (CI):
 *   npx ts-node scripts/check-contrast.ts
 *
 * Exit codes:
 *   0 — all enforced pairs pass (or intentionally-failing BLOCKED pairs fail as expected)
 *   1 — at least one enforced pair fails unexpectedly, OR an expected-fail pair passes
 *
 * Rules:
 * - A pair with `enforced: true` and a name NOT ending in "-BLOCKED" MUST meet minRatio.
 * - A pair with `enforced: true` and a name ending in "-BLOCKED" MUST fail (ratio < minRatio).
 *   This ensures we never accidentally approve a blocked colour combination.
 * - A pair with `enforced: false` is reported but does not affect the exit code.
 *
 * Reference: WCAG 2.x relative luminance formula (IEC 61966-2-1).
 */

import { CONTRAST_PAIRS, ContrastPair } from "../packages/shared/src/design-tokens";

// ── WCAG helpers ──────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) throw new Error(`Invalid hex: ${hex}`);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function sRGBtoLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const R = sRGBtoLinear(r);
  const G = sRGBtoLinear(g);
  const B = sRGBtoLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Runner ────────────────────────────────────────────────────────────────────

interface Result {
  pair: ContrastPair;
  ratio: number;
  passed: boolean;
  isBlockedExpectedFail: boolean;
  outcome: "PASS" | "FAIL" | "WARN" | "BLOCKED-OK" | "BLOCKED-UNEXPECTEDLY-PASSED";
}

function run(): void {
  const results: Result[] = [];
  let ciFailure = false;

  for (const pair of CONTRAST_PAIRS) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    const meetsThreshold = ratio >= pair.minRatio;
    const isBlocked = pair.id.endsWith("-BLOCKED");

    let outcome: Result["outcome"];

    if (!pair.enforced) {
      // Provisional — report only, no CI gate
      outcome = meetsThreshold ? "PASS" : "WARN";
    } else if (isBlocked) {
      // This pair MUST fail — it's in the system to guard against accidental approval
      if (!meetsThreshold) {
        outcome = "BLOCKED-OK";  // Expected to fail
      } else {
        outcome = "BLOCKED-UNEXPECTEDLY-PASSED";
        ciFailure = true;
      }
    } else {
      // Normal enforced pair — must pass
      if (meetsThreshold) {
        outcome = "PASS";
      } else {
        outcome = "FAIL";
        ciFailure = true;
      }
    }

    results.push({ pair, ratio, passed: meetsThreshold, isBlockedExpectedFail: isBlocked, outcome });
  }

  // ── Report ────────────────────────────────────────────────────────────────

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║         SkillLens AI — WCAG 2.x Contrast Report              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const icons: Record<Result["outcome"], string> = {
    "PASS": "✅ PASS",
    "FAIL": "❌ FAIL",
    "WARN": "⚠️  WARN (provisional, not enforced)",
    "BLOCKED-OK": "🚫 BLOCKED (expected fail — combination is prohibited)",
    "BLOCKED-UNEXPECTEDLY-PASSED": "🔴 ERROR — BLOCKED pair unexpectedly passes! A prohibited colour combination now meets threshold.",
  };

  for (const r of results) {
    const ratioStr = r.ratio.toFixed(2).padStart(5);
    const required = `≥ ${r.pair.minRatio.toFixed(1)}`;
    console.log(`${icons[r.outcome]}`);
    console.log(`  ID       : ${r.pair.id}`);
    console.log(`  Pair     : fg=${r.pair.fg}  bg=${r.pair.bg}`);
    console.log(`  Ratio    : ${ratioStr}:1  (required ${required}:1, threshold=${r.pair.threshold})`);
    if (r.pair.notes) console.log(`  Notes    : ${r.pair.notes}`);
    console.log();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const pass   = results.filter(r => r.outcome === "PASS").length;
  const fail   = results.filter(r => r.outcome === "FAIL").length;
  const warn   = results.filter(r => r.outcome === "WARN").length;
  const blocked = results.filter(r => r.outcome === "BLOCKED-OK").length;
  const blocker_err = results.filter(r => r.outcome === "BLOCKED-UNEXPECTEDLY-PASSED").length;

  console.log("──────────────────────────────────────────────────────────────");
  console.log(`Summary: ${pass} pass | ${fail} fail | ${warn} warn (provisional) | ${blocked} blocked-ok | ${blocker_err} blocked-error`);

  if (ciFailure) {
    console.log("\n🔴 CI CHECK FAILED — see FAIL or BLOCKED-UNEXPECTEDLY-PASSED entries above.");
    console.log("   Action required:");
    for (const r of results.filter(r => r.outcome === "FAIL")) {
      console.log(`   • Pair "${r.pair.id}": measured ${r.ratio.toFixed(2)}:1, requires ${r.pair.minRatio}:1.`);
      console.log(`     Stop. Report this pair, the measured ratio, and a proposed alternative.`);
      console.log(`     Wait for written approval before changing any hex value.`);
    }
    for (const r of results.filter(r => r.outcome === "BLOCKED-UNEXPECTEDLY-PASSED")) {
      console.log(`   • BLOCKED pair "${r.pair.id}" now passes (${r.ratio.toFixed(2)}:1).`);
      console.log(`     This means a prohibited colour combination was added to the UI.`);
      console.log(`     Remove the usage and investigate.`);
    }
    process.exit(1);
  } else {
    console.log("\n✅ CI CHECK PASSED — all enforced pairs meet their required thresholds.");
    console.log("   Blocked pairs confirmed to still fail (as required).");
    if (warn > 0) {
      console.log(`   ${warn} provisional pair(s) not yet enforced — Gate 2 approval required.`);
    }
    process.exit(0);
  }
}

run();