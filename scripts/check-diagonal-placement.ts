/**
 * Verify diagonal mosaic: no within/cross overlaps, edge connectivity, draw≈place sizes.
 * Run: npx tsx scripts/check-diagonal-placement.ts [matchId]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { cfg } from "../src/config";
import { createReplayEngine } from "../src/engine/replayEngine";
import { initialMatchState } from "../src/data/mockLiveFeed";
import { resolveRendererLayout } from "../src/design-system/layout/posterLayout";
import { diagonalCompositionMarkScale } from "../src/design-system/layout/designScale";
import { resolveQuadrantEntryDimensions, markRng } from "../src/design-system/layout/markSizing";
import { VISUAL_COMPONENT } from "../src/design-system/mapping/visualMappings";
import type { MatchData } from "../src/data/mockMatch";

function loadFeed(id: string) {
  const path = resolve(process.cwd(), `src/data/feeds/${id}.json`);
  if (!existsSync(path)) throw new Error(`missing feed ${id}`);
  const json = JSON.parse(readFileSync(path, "utf8"));
  return json.feed ?? json;
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const stubMatch: MatchData = {
  homeTeam: "Home",
  awayTeam: "Away",
  homeTeamCode: "HOM",
  awayTeamCode: "AWY",
  stage: "GROUP",
  date: "July 1, 2026",
  venue: "Test",
  home: {
    possession: 50, shots: 10, shotsOnTarget: 4, passAccuracy: 80,
    fouls: 8, yellowCards: 1, redCards: 0, goals: 2, corners: 3, offsides: 1,
    penaltyShootoutScored: 0, penaltyShootoutMissed: 0,
  },
  away: {
    possession: 50, shots: 8, shotsOnTarget: 3, passAccuracy: 75,
    fouls: 6, yellowCards: 1, redCards: 0, goals: 1, corners: 2, offsides: 1,
    penaltyShootoutScored: 0, penaltyShootoutMissed: 0,
  },
};

type Box = { nx: number; ny: number; nw: number; nh: number };

function boxesOverlap(a: Box, b: Box): boolean {
  const ax0 = a.nx - a.nw / 2;
  const ax1 = a.nx + a.nw / 2;
  const ay0 = a.ny - a.nh / 2;
  const ay1 = a.ny + a.nh / 2;
  const bx0 = b.nx - b.nw / 2;
  const bx1 = b.nx + b.nw / 2;
  const by0 = b.ny - b.nh / 2;
  const by1 = b.ny + b.nh / 2;
  const ix = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0));
  const iy = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  return ix * iy > 1e-9;
}

function touches(a: Box, b: Box): boolean {
  const dx = Math.abs(a.nx - b.nx);
  const dy = Math.abs(a.ny - b.ny);
  const eps = 0.005;
  const touchX = Math.abs(dx - (a.nw + b.nw) / 2) < eps;
  const touchY = Math.abs(dy - (a.nh + b.nh) / 2) < eps;
  return (
    (touchX && dy <= (a.nh + b.nh) / 2 + eps) ||
    (touchY && dx <= (a.nw + b.nw) / 2 + eps)
  );
}

function withinOverlaps(boxes: Box[]): number {
  let n = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i], boxes[j])) n++;
    }
  }
  return n;
}

function isolatedCount(boxes: Box[]): number {
  if (boxes.length <= 1) return 0;
  let isolated = 0;
  for (let i = 0; i < boxes.length; i++) {
    const others = boxes.filter((_, j) => j !== i);
    if (!others.some((o) => touches(boxes[i], o))) isolated++;
  }
  return isolated;
}

function main() {
  assert(cfg.composition.diagonalSplit === true, "diagonalSplit must be enabled");

  const matchId = process.argv[2] ?? "1489369";
  const feed = loadFeed(matchId);
  const layout = resolveRendererLayout(1400, 900, { artworkOnly: false });
  const diagonal = diagonalCompositionMarkScale(layout);
  assert(layout.diagonalSplit === true, "layout.diagonalSplit");

  const engine = createReplayEngine(feed, initialMatchState);
  engine.seekToMinute(90, layout, stubMatch);
  const art = engine.getSnapshot().art;
  const gap = cfg.composition.diagonalSeamGap ?? 0.08;

  const home = art.placement.home;
  const away = art.placement.away;
  assert(home.length + away.length > 0, "expected placed mark bboxes");

  // Compare first home goal draw size vs placement box
  const goals = art.goals.filter((g) => g.side === "home");
  if (goals.length && home.length) {
    const g = goals[0];
    const raw = resolveQuadrantEntryDimensions(
      VISUAL_COMPONENT.Goal,
      layout,
      0,
      "home",
      { id: g.id, minute: g.minute, spawnScale: g.spawnScale },
      markRng(g.id, g.minute)
    );
    const drawW = raw.widthPx * g.layoutScale * diagonal;
    const placeW = g.nx; // find matching box — use closest placement
    // Find placement box at same center
    let matchBox = home[0];
    let best = Infinity;
    for (const b of home) {
      const d = Math.hypot(b.nx - g.nx, b.ny - g.ny);
      if (d < best) {
        best = d;
        matchBox = b;
      }
    }
    const placedW = matchBox.nw * layout.artworkWidth;
    const ratio = drawW / Math.max(placedW, 1);
    console.log(
      `size check (home goal): drawW=${drawW.toFixed(1)} placeW=${placedW.toFixed(1)} ratio=${ratio.toFixed(3)}`
    );
    assert(ratio > 0.92 && ratio < 1.08, `draw/place size mismatch ratio=${ratio.toFixed(3)}`);
  }

  function seamCross(side: "home" | "away", boxes: Box[]): number {
    let n = 0;
    for (const b of boxes) {
      if (side === "home") {
        if (b.nx + b.nw / 2 + b.ny + b.nh / 2 > 1 - gap + 1e-6) n++;
      } else if (b.nx - b.nw / 2 + b.ny - b.nh / 2 < 1 + gap - 1e-6) n++;
    }
    return n;
  }

  let crossOverlaps = 0;
  for (const a of home) {
    for (const b of away) {
      if (boxesOverlap(a, b)) crossOverlaps++;
    }
  }

  const homeWithin = withinOverlaps(home);
  const awayWithin = withinOverlaps(away);
  const homeIso = isolatedCount(home);
  const awayIso = isolatedCount(away);
  const homeSeam = seamCross("home", home);
  const awaySeam = seamCross("away", away);

  console.log(`match ${matchId}: home=${home.length} away=${away.length}`);
  console.log(
    `withinOverlaps home=${homeWithin} away=${awayWithin} | cross=${crossOverlaps}`
  );
  console.log(`isolated home=${homeIso} away=${awayIso} | seamCross home=${homeSeam} away=${awaySeam}`);
  console.log(`gap=${gap} diagonalMarkScale=${diagonal}`);

  assert(homeWithin === 0, `${homeWithin} home within-team overlaps`);
  assert(awayWithin === 0, `${awayWithin} away within-team overlaps`);
  assert(crossOverlaps === 0, `${crossOverlaps} cross-team overlaps`);
  assert(homeIso === 0, `${homeIso} home marks without edge touch`);
  assert(awayIso === 0, `${awayIso} away marks without edge touch`);
  assert(homeSeam === 0, `${homeSeam} home bboxes outside triangle`);
  assert(awaySeam === 0, `${awaySeam} away bboxes outside triangle`);

  console.log("Diagonal placement checks passed.");
}

main();
