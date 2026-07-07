/**
 * Detect mark-mark overlaps after full replay for all static feeds.
 * Run: npx tsx scripts/check-mark-overlaps.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { initialMatchState } from "../src/data/mockLiveFeed";
import type { LiveFeedUpdate } from "../src/data/mockLiveFeed";
import { computeLayout } from "../src/design-system/layout/posterLayout";
import {
  markDimensionsFromScale,
  markCenterToPixel,
  teamPlacementBounds,
} from "../src/design-system/layout/quadrantMarkPlacement";
import {
  markRng,
  resolveQuadrantEntryDimensions,
} from "../src/design-system/layout/markSizing";
import { rankInDataset } from "../src/design-system/layout/compositionDensity";
import { createReplayEngine } from "../src/engine/replayEngine";
import { getEventVisualComponent, VISUAL_COMPONENT } from "../src/design-system/mapping/visualMappings";
import type { MatchData } from "../src/data/mockMatch";
import type { AccumulatedArtState } from "../src/design-system/state/artState";
import { SCHEDULE_MATCHES } from "../src/data/schedule.generated";

function loadFeed(id: string): { feed: LiveFeedUpdate[]; match: MatchData } | null {
  const path = join(process.cwd(), "src/data/feeds", `${id}.json`);
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const entry = SCHEDULE_MATCHES.find((e) => e.id === id);
    if (!raw?.feed || !entry?.matchData) return null;
    return { feed: raw.feed, match: entry.matchData };
  } catch {
    return null;
  }
}

interface MarkRect {
  id: string;
  side: "home" | "away";
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function overlaps(a: MarkRect, b: MarkRect): boolean {
  return (
    Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 &&
    Math.abs(a.cy - b.cy) < (a.h + b.h) / 2
  );
}

function collectRects(art: AccumulatedArtState, layout: ReturnType<typeof computeLayout>): MarkRect[] {
  const rects: MarkRect[] = [];

  const push = (
    id: string,
    side: "home" | "away",
    nx: number,
    ny: number,
    component: keyof typeof VISUAL_COMPONENT,
    minute: number,
    spawnScale: number,
    layoutScale: number,
    dataset: Parameters<typeof rankInDataset>[2],
    datasetId: string
  ) => {
    const comp = VISUAL_COMPONENT[component];
    const { cx, cy } = markCenterToPixel(nx, ny, layout);
    const dims = resolveQuadrantEntryDimensions(
      comp,
      layout,
      rankInDataset(art, side, dataset, datasetId),
      side,
      { id: datasetId, minute, spawnScale },
      markRng(datasetId, minute)
    );
    rects.push({
      id,
      side,
      cx,
      cy,
      w: dims.widthPx * (layoutScale > 0 ? layoutScale : 1),
      h: dims.heightPx * (layoutScale > 0 ? layoutScale : 1),
    });
  };

  for (const shot of art.shots) {
    shot.squares.forEach((sq, i) => {
      push(
        `${shot.id}-sq${i}`,
        shot.side,
        sq.nx,
        sq.ny,
        "Shot",
        shot.minute,
        sq.scale,
        sq.layoutScale,
        "shot",
        shot.id
      );
    });
  }
  for (const g of art.goals) {
    push(g.id, g.side, g.nx, g.ny, "Goal", g.minute, g.spawnScale, g.layoutScale, "goal", g.id);
  }
  for (const f of art.fouls) {
    push(f.id, f.side, f.nx, f.ny, "Foul", f.minute, f.spawnScale, f.layoutScale, "foul", f.id);
  }
  for (const c of art.corners) {
    push(c.id, c.side, c.nx, c.ny, "Corner", c.minute, c.spawnScale, c.layoutScale, "corner", c.id);
  }
  for (const o of art.offsides) {
    push(o.id, o.side, o.nx, o.ny, "Offside", o.minute, o.spawnScale, o.layoutScale, "offside", o.id);
  }
  for (const s of art.shotsOnTarget) {
    push(s.id, s.side, s.nx, s.ny, "ShotOnTarget", s.minute, s.spawnScale, s.layoutScale, "shot_on_target", s.id);
  }
  for (const c of art.cards) {
    push(
      c.id,
      c.side,
      c.nx,
      c.ny,
      c.kind === "yellow" ? "YellowCard" : "RedCard",
      c.minute,
      c.spawnScale,
      c.layoutScale,
      "card",
      c.id
    );
  }

  return rects;
}

function edgesTouch(a: MarkRect, b: MarkRect, epsilon = 1): boolean {
  const dx = Math.abs(a.cx - b.cx);
  const dy = Math.abs(a.cy - b.cy);
  const touchX = Math.abs(dx - (a.w + b.w) / 2) < epsilon;
  const touchY = Math.abs(dy - (a.h + b.h) / 2) < epsilon;
  return (
    (touchX && dy <= (a.h + b.h) / 2 + epsilon) ||
    (touchY && dx <= (a.w + b.w) / 2 + epsilon)
  );
}

function checkSideGaps(rects: MarkRect[], side: "home" | "away"): string[] {
  const team = rects.filter((r) => r.side === side);
  if (team.length <= 1) return [];
  const gaps: string[] = [];
  for (const mark of team) {
    const touches = team.some((other) => other.id !== mark.id && edgesTouch(mark, other));
    if (!touches) gaps.push(mark.id);
  }
  return gaps;
}

function checkSideOverlaps(rects: MarkRect[], side: "home" | "away") {
  const team = rects.filter((r) => r.side === side);
  const pairs: string[] = [];
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      if (overlaps(team[i], team[j])) {
        pairs.push(`${team[i].id} ∩ ${team[j].id}`);
      }
    }
  }
  return pairs;
}

const TARGET_IDS = ["1567824", "1567308", "1489383", "1568100"];

function main() {
  const feedDir = join(process.cwd(), "src/data/feeds");
  const allIds = [
    ...new Set([...TARGET_IDS, ...readdirSync(feedDir).map((f) => f.replace(/\.json$/, ""))]),
  ];

  let overlapFailures = 0;
  let gapWarnings = 0;
  for (const id of allIds) {
    const bundle = loadFeed(id);
    if (!bundle) continue;

    const layout = computeLayout(1920, 1080);
    const engine = createReplayEngine(bundle.feed, initialMatchState);
    engine.seekToMinute(90, layout, bundle.match);
    const art = engine.getSnapshot().art;
    const rects = collectRects(art, layout);

    const eventCount = bundle.feed.filter((u) => u.type === "event").length;
    const homePairs = checkSideOverlaps(rects, "home");
    const awayPairs = checkSideOverlaps(rects, "away");
    const homeGaps = checkSideGaps(rects, "home");
    const awayGaps = checkSideGaps(rects, "away");

    if (homePairs.length || awayPairs.length) {
      overlapFailures++;
      const entry = SCHEDULE_MATCHES.find((e) => e.id === id);
      const label = entry
        ? `${entry.homeTeamCode} vs ${entry.awayTeamCode}`
        : id;
      console.log(`\nFAIL ${id} (${label}) events=${eventCount} marks=${rects.length}`);
      if (homePairs.length) {
        console.log(`  home overlaps: ${homePairs.length} (${homePairs.slice(0, 3).join("; ")}...)`);
      }
      if (awayPairs.length) {
        console.log(`  away overlaps: ${awayPairs.length} (${awayPairs.slice(0, 3).join("; ")}...)`);
      }
    } else if (homeGaps.length || awayGaps.length) {
      gapWarnings++;
      const entry = SCHEDULE_MATCHES.find((e) => e.id === id);
      const label = entry
        ? `${entry.homeTeamCode} vs ${entry.awayTeamCode}`
        : id;
      console.log(`\nFAIL ${id} (${label}) events=${eventCount} marks=${rects.length}`);
      if (homeGaps.length) console.log(`  home gaps: ${homeGaps.length} (${homeGaps.slice(0, 3).join("; ")}...)`);
      if (awayGaps.length) console.log(`  away gaps: ${awayGaps.length} (${awayGaps.slice(0, 3).join("; ")}...)`);
    }
  }

  if (overlapFailures === 0) {
    console.log(
      `OK — no mark overlaps in ${allIds.length} feeds checked` +
        (gapWarnings > 0 ? ` (${gapWarnings} with isolated marks).` : ".")
    );
  } else {
    console.log(`\n${overlapFailures} feeds with mark overlaps.`);
    process.exit(1);
  }
}

main();
