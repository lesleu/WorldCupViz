/**
 * Diagnose mark placement — flags corner clustering and nx/ny = 0 pile-ups.
 * Run: npx tsx scripts/check-mark-layout.ts
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { mockMatch } from "../src/data/mockMatch";
import { matchUpdates, initialMatchState } from "../src/data/mockLiveFeed";
import type { LiveFeedUpdate } from "../src/data/mockLiveFeed";
import { computeLayout, computeArtworkLayout, gridRegionForSide } from "../src/design-system/layout/posterLayout";
import { teamPlacementBounds } from "../src/design-system/layout/quadrantMarkPlacement";
import { createReplayEngine } from "../src/engine/replayEngine";
import type { MatchData } from "../src/data/mockMatch";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function loadFixtureFeeds(): { id: string; feed: LiveFeedUpdate[]; match: MatchData }[] {
  const dir = resolve(process.cwd(), "public/data/matches");
  if (!existsSync(dir)) return [];

  const results: { id: string; feed: LiveFeedUpdate[]; match: MatchData }[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    if (!raw?.feed?.length || !raw?.match) continue;
    results.push({ id: file.replace(/\.json$/, ""), feed: raw.feed, match: raw.match });
  }
  return results;
}

interface MarkPoint {
  nx: number;
  ny: number;
  kind: string;
}

function collectMarks(art: ReturnType<typeof createReplayEngine>["getSnapshot"] extends () => infer R ? R : never): {
  home: MarkPoint[];
  away: MarkPoint[];
} {
  const home: MarkPoint[] = [];
  const away: MarkPoint[] = [];

  const push = (side: "home" | "away", nx: number, ny: number, kind: string) => {
    (side === "home" ? home : away).push({ nx, ny, kind });
  };

  const artState = (art as { art: {
    shots: { side: string; squares: { nx: number; ny: number }[] }[];
    goals: { side: string; nx: number; ny: number }[];
    fouls: { side: string; nx: number; ny: number }[];
    corners: { side: string; nx: number; ny: number }[];
    offsides: { side: string; nx: number; ny: number }[];
    shotsOnTarget: { side: string; nx: number; ny: number }[];
    cards: { side: string; nx: number; ny: number }[];
  } }).art;

  for (const shot of artState.shots) {
    for (const sq of shot.squares) {
      push(shot.side as "home" | "away", sq.nx, sq.ny, "shot");
    }
  }
  for (const g of artState.goals) push(g.side as "home" | "away", g.nx, g.ny, "goal");
  for (const f of artState.fouls) push(f.side as "home" | "away", f.nx, f.ny, "foul");
  for (const c of artState.corners) push(c.side as "home" | "away", c.nx, c.ny, "corner");
  for (const o of artState.offsides) push(o.side as "home" | "away", o.nx, o.ny, "offside");
  for (const s of artState.shotsOnTarget) push(s.side as "home" | "away", s.nx, s.ny, "sot");
  for (const c of artState.cards) push(c.side as "home" | "away", c.nx, c.ny, "card");

  return { home, away };
}

function analyzeCluster(
  marks: MarkPoint[],
  side: "home" | "away",
  layout: ReturnType<typeof computeLayout>
): string[] {
  const issues: string[] = [];
  if (marks.length === 0) return issues;

  const atOrigin = marks.filter((m) => m.nx < 0.02 && m.ny < 0.02);
  if (atOrigin.length > 0) {
    issues.push(`${atOrigin.length} marks at nx≈0 ny≈0 (${atOrigin.map((m) => m.kind).join(",")})`);
  }

  const grid = gridRegionForSide(layout, side);
  const gridCx = (grid.left + grid.right) / 2;
  const gridCy = (grid.top + grid.bottom) / 2;
  let inGrid = 0;
  for (const m of marks) {
    const cx = layout.margin + m.nx * layout.artworkWidth;
    const cy = layout.artworkTop + m.ny * layout.artworkHeight;
    const dx = Math.abs(cx - gridCx);
    const dy = Math.abs(cy - gridCy);
    if (dx < grid.width / 2 && dy < grid.height / 2) inGrid++;
  }
  if (inGrid > 0) {
    issues.push(`${inGrid}/${marks.length} marks overlap possession grid corner`);
  }

  const bounds = teamPlacementBounds(layout, side);
  const outerX = side === "home" ? bounds.left : bounds.left + bounds.width;
  const topY = bounds.top;

  let cornerCount = 0;
  for (const m of marks) {
    const cx = layout.margin + m.nx * layout.artworkWidth;
    const cy = layout.artworkTop + m.ny * layout.artworkHeight;
    const d = Math.hypot(cx - outerX, cy - topY);
    if (d < Math.min(bounds.width, bounds.height) * 0.15) cornerCount++;
  }

  if (cornerCount > marks.length * 0.45) {
    issues.push(`${cornerCount}/${marks.length} marks in outer top corner zone`);
  }

  const xs = marks.map((m) => m.nx);
  const ys = marks.map((m) => m.ny);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  if (marks.length >= 4 && (spreadX < 0.08 || spreadY < 0.08)) {
    issues.push(`tight cluster spreadX=${spreadX.toFixed(3)} spreadY=${spreadY.toFixed(3)}`);
  }

  return issues;
}

async function main() {
  loadEnvLocal();
  const fixtures = loadFixtureFeeds();
  if (fixtures.length === 0) {
    fixtures.push({ id: "mock-mex-kor", feed: matchUpdates, match: mockMatch });
  }

  // Stress test — many events on one side
  const stressFeed: LiveFeedUpdate[] = [initialMatchState];
  for (let m = 1; m <= 90; m += 2) {
    stressFeed.push({
      minute: m,
      type: "event",
      team: m % 4 === 0 ? "away" : "home",
      eventType: m % 7 === 0 ? "goal" : m % 3 === 0 ? "shot_on_target" : "shot",
    });
  }
  fixtures.push({ id: "stress-45-events", feed: stressFeed, match: mockMatch });

  let anyIssue = false;
  for (const { id, feed, match } of fixtures) {
    for (const layoutFn of [computeLayout, computeArtworkLayout]) {
      const label = layoutFn === computeLayout ? "poster" : "artwork";
      const layout = layoutFn(1920, 1080);
      const engine = createReplayEngine(feed, initialMatchState);
      engine.seekToMinute(90, layout, match);
      const { home, away } = collectMarks(engine.getSnapshot());

      const homeIssues = analyzeCluster(home, "home", layout);
      const awayIssues = analyzeCluster(away, "away", layout);

      if (homeIssues.length || awayIssues.length) {
        anyIssue = true;
        console.log(`\n${id} [${label}]`);
        if (homeIssues.length) console.log(`  home: ${homeIssues.join("; ")}`);
        if (awayIssues.length) console.log(`  away: ${awayIssues.join("; ")}`);
      }
    }
  }

  if (!anyIssue) {
    console.log("OK — no corner clustering detected across fixtures.");
  } else {
    process.exit(1);
  }
}

void main();
