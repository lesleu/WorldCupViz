import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

async function assertFirstVisitToday(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-home-scroller]", { timeout: 30_000 });
  await page.waitForFunction(() => {
    return (
      sessionStorage.getItem("wc-vizi-home-restore-pending") !== "1" &&
      sessionStorage.getItem("wc-vizi-home-returning-from-match") !== "1"
    );
  }, { timeout: 15_000 });

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

  if (!metrics || metrics.delta > 24) {
    const debug = await page.evaluate(() => {
      const scrollerEl = document.querySelector("[data-home-scroller]");
      const todayHeading = [...document.querySelectorAll("h2")].find(
        (node) => node.textContent?.trim() === "Today"
      );
      const section = todayHeading?.closest("section");
      return {
        sectionId: section?.id ?? null,
        dateSectionIds: [...document.querySelectorAll('[id^="date-"]')].map(
          (node) => node.id
        ),
        scrollTop: scrollerEl instanceof HTMLElement ? scrollerEl.scrollTop : null,
      };
    });
    throw new Error(`Today scroll failed: ${JSON.stringify({ metrics, debug })}`);
  }

  console.log("✓ first visit lands on Today");
}

async function assertReturnRestoresScroll(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-home-scroller]", { timeout: 30_000 });
  await page.waitForFunction(() => {
    return (
      sessionStorage.getItem("wc-vizi-home-restore-pending") !== "1" &&
      sessionStorage.getItem("wc-vizi-home-returning-from-match") !== "1"
    );
  }, { timeout: 15_000 });

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem("wc-vizi-home-matches");
    if (!raw) return false;
    try {
      return JSON.parse(raw).length > 0;
    } catch {
      return false;
    }
  }, { timeout: 30_000 });

  const navigation = await page.evaluate(async () => {
    const scrollerEl = document.querySelector("[data-home-scroller]");
    if (!(scrollerEl instanceof HTMLElement)) return null;

    const target = Math.min(
      scrollerEl.scrollHeight - scrollerEl.clientHeight - 8,
      scrollerEl.scrollTop + 900
    );
    scrollerEl.scrollTop = target;
    scrollerEl.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 300));

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
        compactHeader: scrollerEl.dataset.compactHeader === "true",
        anchorDateSort,
        anchorOffset,
      })
    );
    sessionStorage.setItem("wc-vizi-home-restore-pending", "1");
    sessionStorage.setItem("wc-vizi-home-returning-from-match", "1");

    const link = document.querySelector('a[href^="/match/"]');
    return {
      savedScroll: scrollTop,
      matchHref: link instanceof HTMLAnchorElement ? link.getAttribute("href") : null,
    };
  });

  if (!navigation?.matchHref || navigation.savedScroll < 500) {
    throw new Error(`failed to seed scroll state: ${JSON.stringify(navigation)}`);
  }

  const savedBefore = navigation.savedScroll;
  await page.goto(new URL(navigation.matchHref, BASE).href, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL(/\/match\//, { timeout: 15_000 });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForURL((url) => {
    const value = url.toString();
    return value === BASE || value === `${BASE}/`;
  }, { timeout: 15_000 });

  await page.waitForSelector("[data-home-scroller]", { timeout: 30_000 });
  await page.waitForFunction(() => {
    return (
      sessionStorage.getItem("wc-vizi-home-restore-pending") !== "1" &&
      sessionStorage.getItem("wc-vizi-home-returning-from-match") !== "1"
    );
  }, { timeout: 15_000 });

  const restored = await page.evaluate(() => {
    const scrollerEl = document.querySelector("[data-home-scroller]");
    return scrollerEl instanceof HTMLElement ? scrollerEl.scrollTop : null;
  });

  if (restored == null || Math.abs(restored - savedBefore) > 48) {
    const debug = await page.evaluate(() => {
      const raw = sessionStorage.getItem("wc-vizi-home-scroll");
      return {
        restored:
          document.querySelector("[data-home-scroller]") instanceof HTMLElement
            ? document.querySelector("[data-home-scroller]").scrollTop
            : null,
        saved: raw ? JSON.parse(raw) : null,
      };
    });
    throw new Error(
      `restore failed: expected ${savedBefore}, got ${restored}; debug=${JSON.stringify(debug)}`
    );
  }

  console.log("✓ return from match restores scroll");
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await assertFirstVisitToday(page);
    await assertReturnRestoresScroll(page);
    console.log("home scroll e2e passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
