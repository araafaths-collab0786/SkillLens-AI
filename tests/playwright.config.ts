import { defineConfig, devices } from "@playwright/test";

/**
 * SkillLens AI — Playwright Configuration
 * Section 4A viewport matrix:
 *   - iPhone SE (375 × 667) — small phone
 *   - Common Android (412 × 915) — large phone
 *   - Landscape phone (667 × 375)
 *   - iPad (768 × 1024) — tablet portrait
 *   - iPad landscape (1024 × 768)
 *   - Laptop (1366 × 768)
 *   - Desktop (1920 × 1080)
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // ── Phone ───────────────────────────────────────────────────────────────
    {
      name: "iPhone SE (375×667)",
      use: {
        ...devices["iPhone SE"],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: "Android Phone (412×915)",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 412, height: 915 },
      },
    },
    {
      name: "Landscape Phone (667×375)",
      use: {
        ...devices["iPhone SE landscape"],
        viewport: { width: 667, height: 375 },
      },
    },

    // ── Tablet ──────────────────────────────────────────────────────────────
    {
      name: "iPad Portrait (768×1024)",
      use: {
        ...devices["iPad (gen 7)"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "iPad Landscape (1024×768)",
      use: {
        ...devices["iPad (gen 7) landscape"],
        viewport: { width: 1024, height: 768 },
      },
    },

    // ── Laptop / Desktop ────────────────────────────────────────────────────
    {
      name: "Laptop (1366×768)",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "Desktop (1920×1080)",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
