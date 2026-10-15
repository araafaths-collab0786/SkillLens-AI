/**
 * SkillLens AI — Horizontal Overflow Check
 *
 * Fails the build if any page causes horizontal scrolling at 320px wide.
 * Runs as part of CI. Reference: Section 4A requirement.
 *
 * Updated in Phase 6 to cover dashboard and auth-redirect pages as well.
 * Protected pages (dashboard etc.) redirect to /login when unauthenticated —
 * we test the redirected-to page for overflow, not the protected content.
 */

import { test, expect } from "@playwright/test";

const VIEWPORT_320 = { width: 320, height: 568 };

// Public pages we can reach without auth
const PUBLIC_PAGES = ["/", "/login"];

for (const pagePath of PUBLIC_PAGES) {
  test(`No horizontal overflow at 320px — ${pagePath}`, async ({ page }) => {
    await page.setViewportSize(VIEWPORT_320);
    await page.goto(pagePath);
    await page.waitForLoadState("domcontentloaded");

    const overflow = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(
      overflow.bodyScrollWidth,
      `${pagePath}: body.scrollWidth (${overflow.bodyScrollWidth}) > innerWidth (${overflow.innerWidth})`
    ).toBeLessThanOrEqual(overflow.innerWidth + 1);

    expect(
      overflow.htmlScrollWidth,
      `${pagePath}: html.scrollWidth (${overflow.htmlScrollWidth}) > innerWidth (${overflow.innerWidth})`
    ).toBeLessThanOrEqual(overflow.innerWidth + 1);
  });
}

// Protected pages redirect to /login — check the login redirect page for overflow
test("No horizontal overflow at 320px — /dashboard (redirects to /login)", async ({ page }) => {
  await page.setViewportSize(VIEWPORT_320);
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
  // Allow redirect to /login
  await page.waitForTimeout(500);

  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
  expect(overflow.htmlScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
});
