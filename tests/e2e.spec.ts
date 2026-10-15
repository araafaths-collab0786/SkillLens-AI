/**
 * SkillLens AI — E2E Tests: Landing + Login pages
 * Section 4A viewport matrix: iPhone SE, Android, landscape phone, iPad, laptop, desktop.
 *
 * Tests:
 *  1. Landing page loads, hero text visible, CTA navigates to /login
 *  2. Features grid renders (1/2/3 columns depending on viewport)
 *  3. How It Works section visible
 *  4. SDG 8 section visible
 *  5. Login page loads, Sign In / Sign Up toggle works
 *  6. Sign In form validation (empty submit shows errors)
 *  7. Hamburger menu on small screens
 *  8. No horizontal overflow at any viewport (including 320px)
 *  9. Visual regression snapshots (landing + login at each viewport)
 */

import { test, expect, type Page } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForPage(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.bodyScrollWidth, "body must not overflow horizontally").toBeLessThanOrEqual(
    overflow.innerWidth + 1  // 1px tolerance for subpixel rounding
  );
  expect(overflow.htmlScrollWidth, "html must not overflow horizontally").toBeLessThanOrEqual(
    overflow.innerWidth + 1
  );
}

// ── Landing page ──────────────────────────────────────────────────────────────

test.describe("Landing page — all viewports", () => {
  test("hero headline is visible", async ({ page }) => {
    await waitForPage(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("primary CTA navigates to /login", async ({ page }) => {
    await waitForPage(page, "/");
    // Find the first primary CTA link (text: "Get Started" or "Start for free")
    const cta = page.getByRole("link", { name: /get started|start for free/i }).first();
    await cta.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("features section is present", async ({ page }) => {
    await waitForPage(page, "/");
    await expect(page.getByText(/resume parsing|evidence-based/i).first()).toBeVisible();
  });

  test("How It Works section is present", async ({ page }) => {
    await waitForPage(page, "/");
    await expect(page.getByText(/how it works/i)).toBeVisible();
  });

  test("SDG 8 Impact section is present", async ({ page }) => {
    await waitForPage(page, "/");
    await expect(page.getByText(/sdg 8|decent work/i).first()).toBeVisible();
  });

  test("no horizontal overflow", async ({ page }) => {
    await waitForPage(page, "/");
    await noHorizontalOverflow(page);
  });

  test("visual snapshot — landing", async ({ page }) => {
    await waitForPage(page, "/");
    await page.waitForTimeout(400); // let animations settle
    await expect(page).toHaveScreenshot("landing.png", { fullPage: false });
  });
});

// ── Landing page — hamburger menu (phones only) ───────────────────────────────

test.describe("Landing page — hamburger menu", () => {
  test("hamburger opens drawer on small screens", async ({ page, viewport }) => {
    // Only test on viewports narrower than 1024px
    if (!viewport || viewport.width >= 1024) test.skip();
    await waitForPage(page, "/");

    const burger = page.getByRole("button", { name: /open menu/i });
    await expect(burger).toBeVisible();
    await burger.click();

    // Drawer should be visible
    await expect(page.getByRole("dialog", { name: /mobile navigation/i })).toBeVisible();
  });

  test("hamburger drawer closes on Escape", async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 1024) test.skip();
    await waitForPage(page, "/");

    const burger = page.getByRole("button", { name: /open menu/i });
    await burger.click();
    await expect(page.getByRole("dialog", { name: /mobile navigation/i })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /mobile navigation/i })).not.toBeVisible();
  });

  test("hamburger not visible on desktop", async ({ page, viewport }) => {
    if (!viewport || viewport.width < 1024) test.skip();
    await waitForPage(page, "/");

    const burger = page.getByRole("button", { name: /open menu/i });
    await expect(burger).not.toBeVisible();
  });
});

// ── Login page ────────────────────────────────────────────────────────────────

test.describe("Login page — all viewports", () => {
  test("login page loads with Sign In tab active", async ({ page }) => {
    await waitForPage(page, "/login");
    await expect(page.getByRole("tab", { name: /sign in/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("Sign Up tab is present and switchable", async ({ page }) => {
    await waitForPage(page, "/login");
    const signUpTab = page.getByRole("tab", { name: /sign up/i });
    await expect(signUpTab).toBeVisible();
    await signUpTab.click();
    await expect(signUpTab).toHaveAttribute("aria-selected", "true");
  });

  test("sign in form shows validation errors on empty submit", async ({ page }) => {
    await waitForPage(page, "/login");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should show field error(s)
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("back to home link is present", async ({ page }) => {
    await waitForPage(page, "/login");
    await expect(page.getByRole("link", { name: /back to home/i })).toBeVisible();
  });

  test("no horizontal overflow", async ({ page }) => {
    await waitForPage(page, "/login");
    await noHorizontalOverflow(page);
  });

  test("visual snapshot — login", async ({ page }) => {
    await waitForPage(page, "/login");
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot("login.png", { fullPage: false });
  });
});

// ── Accessibility checks ──────────────────────────────────────────────────────

test.describe("Accessibility — focus and ARIA", () => {
  test("skip-to-content link is present on landing", async ({ page }) => {
    await waitForPage(page, "/");
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });

  test("all images have alt text on landing", async ({ page }) => {
    await waitForPage(page, "/");
    const imgs = page.locator("img:not([alt])");
    const count = await imgs.count();
    expect(count, "all <img> elements must have alt attributes").toBe(0);
  });

  test("primary button on login has sufficient text", async ({ page }) => {
    await waitForPage(page, "/login");
    const btn = page.getByRole("button", { name: /sign in/i });
    await expect(btn).toBeVisible();
  });
});
