/**
 * E2E checks for homepage scroll: first load lands on Today, return restores position.
 * Run: npx playwright test scripts/test-home-scroll.spec.mjs --config=scripts/playwright.config.mjs
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("homepage scroll", () => {
  test("first visit scrolls to Today", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "networkidle" });

    const scroller = page.locator("[data-home-scroller]");
    await expect(scroller).toBeVisible({ timeout: 30_000 });

    await expect(page.getByRole("heading", { name: /^Today$/i }).first()).toBeVisible();

    const todaySection = page.locator('[id^="date-"]').filter({ has: page.getByRole("heading", { name: "Today" }) }).first();
    await expect(todaySection).toBeVisible();

    const metrics = await page.evaluate(() => {
      const scrollerEl = document.querySelector("[data-home-scroller]");
      const todayHeading = [...document.querySelectorAll("h2")].find(
        (node) => node.textContent?.trim() === "Today"
      );
      const section = todayHeading?.closest("section");
      if (!(scrollerEl instanceof HTMLElement) || !(section instanceof HTMLElement)) {
        return null;
      }

      const sectionTop =
        section.getBoundingClientRect().top -
        scrollerEl.getBoundingClientRect().top +
        scrollerEl.scrollTop;

      return {
        scrollTop: scrollerEl.scrollTop,
        sectionTop,
        delta: Math.abs(scrollerEl.scrollTop - sectionTop),
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics.delta).toBeLessThanOrEqual(16);
  });

  test("return from match restores scroll position", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    const scroller = page.locator("[data-home-scroller]");
    await expect(scroller).toBeVisible({ timeout: 30_000 });

    const savedBefore = await page.evaluate(async () => {
      const scrollerEl = document.querySelector("[data-home-scroller]");
      if (!(scrollerEl instanceof HTMLElement)) return null;

      scrollerEl.scrollTop = 2400;
      scrollerEl.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 200));

      const scrollTop = scrollerEl.scrollTop;
      let anchorDateSort;
      let anchorOffset = 0;
      for (const section of scrollerEl.querySelectorAll('[id^="date-"]')) {
        if (!(section instanceof HTMLElement)) continue;
        const sectionTop =
          section.getBoundingClientRect().top -
          scrollerEl.getBoundingClientRect().top +
          scrollerEl.scrollTop;
        if (sectionTop <= scrollTop + 1) {
          anchorDateSort = section.id.replace(/^date-/, "");
          anchorOffset = scrollTop - sectionTop;
        }
      }

      sessionStorage.setItem(
        "wc-vizi-home-scroll",
        JSON.stringify({
          scrollTop,
          compactHeader: true,
          anchorDateSort,
          anchorOffset,
        })
      );
      sessionStorage.setItem("wc-vizi-home-restore-pending", "1");
      sessionStorage.setItem("wc-vizi-home-returning-from-match", "1");

      return { scrollTop, anchorDateSort, anchorOffset };
    });

    expect(savedBefore).not.toBeNull();
    expect(savedBefore.scrollTop).toBeGreaterThan(500);

    const firstLink = page.locator('a[href^="/match/"]').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();
    await page.waitForURL(/\/match\//, { timeout: 15_000 });

    const back = page.getByRole("link", { name: /back/i }).first();
    await expect(back).toBeVisible();
    await back.click();
    await page.waitForURL(BASE, { timeout: 15_000 });
    await expect(scroller).toBeVisible({ timeout: 30_000 });

    await page.waitForFunction(
      (expected) => {
        const scrollerEl = document.querySelector("[data-home-scroller]");
        if (!(scrollerEl instanceof HTMLElement)) return false;
        return Math.abs(scrollerEl.scrollTop - expected) <= 24;
      },
      savedBefore.scrollTop,
      { timeout: 10_000 }
    );

    const restored = await page.evaluate(() => {
      const scrollerEl = document.querySelector("[data-home-scroller]");
      return scrollerEl instanceof HTMLElement ? scrollerEl.scrollTop : null;
    });

    expect(restored).not.toBeNull();
    expect(Math.abs(restored - savedBefore.scrollTop)).toBeLessThanOrEqual(24);
  });
});
