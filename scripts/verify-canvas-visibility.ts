/**
 * Verify 1:1 feed→canvas mapping, stats parity, and minimum visible mark size.
 * Run: npm run verify:canvas
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initialMatchState } from "../src/data/mockLiveFeed";
import type { LiveFeedUpdate } from "../src/data/mockLiveFeed";
import { resolveRendererLayout } from "../src/design-system/layout/posterLayout";
import { createReplayEngine } from "../src/engine/replayEngine";
import { deriveTeamStatsFromFeed } from "../src/lib/matches/feedAdapter";
import { SCHEDULE_MATCHES } from "../src/data/schedule.generated";
import type { AccumulatedArtState } from "../src/design-system/state/artState";
import { VISUAL_COMPONENT } from "../src/design-system/mapping/visualMappings";
import { resolveQuadrantEntryDimensions, markRng } from "../src/design-system/layout/markSizing";
import { rankInDataset } from "../src/design-system/layout/compositionDensity";
import { eventMarksConfig } from "../src/config/eventMarks.config";
import { cfg } from "../src/config";

const MIN_VISIBLE_PX = eventMarksConfig.minMarkPx * 0.75;

function shotCanvasCount(art: AccumulatedArtState, side: "home" | "away"): number {
  return (
    art.shots.filter((m) => m.side === side).length +
    art.shotsOnTarget.filter((m) => m.side === side).length +
    art.goals.filter((m) => m.side === side).length
  );
}

function minShotPx(art: AccumulatedArtState, layout: ReturnType<typeof resolveRendererLayout>): number {
  let min = Number.POSITIVE_INFINITY;
  for (const shot of art.shots) {
    const rank = rankInDataset(art, shot.side, "shot", shot.id);
    for (const sq of shot.squares) {
      const dims = resolveQuadrantEntryDimensions(
        VISUAL_COMPONENT.Shot,
        layout,
        rank,
        shot.side,
        { id: shot.id, minute: shot.minute, spawnScale: sq.scale },
        markRng(shot.id, shot.minute)
      );
      const px = Math.min(dims.widthPx * sq.layoutScale, dims.heightPx * sq.layoutScale);
      min = Math.min(min, px);
    }
  }
  return min === Number.POSITIVE_INFINITY ? MIN_VISIBLE_PX : min;
}

function expectedMarkIds(feed: LiveFeedUpdate[], maxMinute: number): string[] {
  const ids: string[] = [];
  const regulationGoals: Record<"home" | "away", string[]> = {
    home: [],
    away: [],
  };
  const shootoutGoals: Record<"home" | "away", string[]> = {
    home: [],
    away: [],
  };

  for (let i = 0; i < feed.length; i++) {
    const u = feed[i];
    if (u.type !== "event" || u.minute > maxMinute) continue;

    if (u.eventType === "goal_cancelled") {
      const removed = regulationGoals[u.team].pop();
      if (removed) {
        const idx = ids.indexOf(removed);
        if (idx >= 0) ids.splice(idx, 1);
      }
      continue;
    }

    if (u.eventType === "penalty_cancelled") {
      const removed = shootoutGoals[u.team].pop();
      if (removed) {
        const idx = ids.indexOf(removed);
        if (idx >= 0) ids.splice(idx, 1);
      }
      continue;
    }

    const baseId = `u${i}-${u.minute}-${u.team}-${u.eventType}`;
    if (u.eventType === "shot" || u.eventType === "penalty_missed") {
      const squares = Math.max(
        1,
        Math.round(cfg.shots.squaresPerShot * cfg.composition.densityMultiplier)
      );
      if (squares === 1) ids.push(baseId);
      else for (let s = 0; s < squares; s++) ids.push(`${baseId}-sq${s}`);
    } else {
      ids.push(baseId);
      if (u.eventType === "goal") regulationGoals[u.team].push(baseId);
      if (u.eventType === "penalty_scored") shootoutGoals[u.team].push(baseId);
    }
  }
  return ids.sort();
}

function actualMarkIds(art: AccumulatedArtState): string[] {
  const ids: string[] = [];
  for (const shot of art.shots) {
    if (shot.squares.length === 1) ids.push(shot.id);
    else shot.squares.forEach((_, i) => ids.push(`${shot.id}-sq${i}`));
  }
  for (const g of art.goals) ids.push(g.id);
  for (const f of art.fouls) ids.push(f.id);
  for (const c of art.corners) ids.push(c.id);
  for (const o of art.offsides) ids.push(o.id);
  for (const s of art.shotsOnTarget) ids.push(s.id);
  for (const c of art.cards) ids.push(c.id);
  return ids.sort();
}

function main() {
  const layout = resolveRendererLayout(1400, 900, { artworkOnly: false });
  const failures: string[] = [];
  let checked = 0;

  for (const entry of SCHEDULE_MATCHES) {
    if (!entry.hasReplayFeed) continue;
    const feed = JSON.parse(readFileSync(resolve(`src/data/feeds/${entry.id}.json`), "utf8"))
      .feed as LiveFeedUpdate[];
    const finalMinute = entry.finalMinute ?? 90;

    const engine = createReplayEngine(feed, initialMatchState);
    engine.seekToMinute(finalMinute, layout, entry.matchData);
    const art = engine.getSnapshot().art;
    const stats = deriveTeamStatsFromFeed(feed, { upToMinute: finalMinute });

    const expected = expectedMarkIds(feed, finalMinute);
    const actual = actualMarkIds(art);
    const missing = expected.filter((id) => !actual.includes(id));
    const extra = actual.filter((id) => !expected.includes(id));

    if (missing.length || extra.length) {
      failures.push(
        `${entry.id}: mapping missing=${missing.length} extra=${extra.length}`
      );
    }

    for (const side of ["home", "away"] as const) {
      if (stats[side].shots !== shotCanvasCount(art, side)) {
        failures.push(
          `${entry.id} ${side}: stats shots=${stats[side].shots} canvas=${shotCanvasCount(art, side)}`
        );
      }
    }

    const minPx = minShotPx(art, layout);
    if (minPx < MIN_VISIBLE_PX) {
      failures.push(`${entry.id}: smallest shot ${minPx.toFixed(1)}px < ${MIN_VISIBLE_PX}px`);
    }

    for (const shot of art.shots) {
      for (const sq of shot.squares) {
        if (sq.nx === 0 && sq.ny === 0) {
          failures.push(`${entry.id}: unplaced shot ${shot.id}`);
          break;
        }
      }
    }

    checked++;
  }

  if (failures.length > 0) {
    console.error(`FAIL — ${failures.length} issue(s) in ${checked} feeds:\n`);
    for (const line of failures.slice(0, 20)) console.error(`  ${line}`);
    if (failures.length > 20) console.error(`  …and ${failures.length - 20} more`);
    process.exit(1);
  }

  console.log(
    `OK — ${checked} feeds: 1:1 marks, stats parity, all shots ≥${MIN_VISIBLE_PX}px visible.`
  );
}

main();
