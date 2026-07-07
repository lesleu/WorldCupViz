/**
 * Verify every feed event maps 1:1 to a canvas mark at each match's final minute.
 * Run: npm run verify:marks
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { initialMatchState } from "../src/data/mockLiveFeed";
import type { LiveFeedUpdate } from "../src/data/mockLiveFeed";
import { computeLayout } from "../src/design-system/layout/posterLayout";
import { createReplayEngine } from "../src/engine/replayEngine";
import type { AccumulatedArtState } from "../src/design-system/state/artState";
import { SCHEDULE_MATCHES } from "../src/data/schedule.generated";
import { cfg } from "../src/config";

const SKIP_EVENTS = new Set<string>();

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
      if (squares === 1) {
        ids.push(baseId);
      } else {
        for (let s = 0; s < squares; s++) {
          ids.push(`${baseId}-sq${s}`);
        }
      }
    } else {
      ids.push(baseId);
      if (u.eventType === "goal") {
        regulationGoals[u.team].push(baseId);
      }
      if (u.eventType === "penalty_scored") {
        shootoutGoals[u.team].push(baseId);
      }
    }
  }
  return ids.sort();
}

function actualMarkIds(art: AccumulatedArtState): string[] {
  const ids: string[] = [];
  for (const shot of art.shots) {
    if (shot.squares.length === 1) {
      ids.push(shot.id);
    } else {
      shot.squares.forEach((_, i) => ids.push(`${shot.id}-sq${i}`));
    }
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
  const layout = computeLayout(1920, 1080);
  const failures: string[] = [];
  let checked = 0;

  for (const entry of SCHEDULE_MATCHES) {
    if (!entry.hasReplayFeed) continue;
    const path = resolve(process.cwd(), `src/data/feeds/${entry.id}.json`);
    const feed = JSON.parse(readFileSync(path, "utf8")).feed as LiveFeedUpdate[];
    const finalMinute = entry.finalMinute ?? 90;

    const engine = createReplayEngine(feed, initialMatchState);
    engine.seekToMinute(finalMinute, layout, entry.matchData);
    const art = engine.getSnapshot().art;

    const expected = expectedMarkIds(feed, finalMinute);
    const actual = actualMarkIds(art);

    const missing = expected.filter((id) => !actual.includes(id));
    const extra = actual.filter((id) => !expected.includes(id));

    if (missing.length > 0 || extra.length > 0) {
      failures.push(
        `${entry.id} (${entry.matchData.homeTeam} vs ${entry.matchData.awayTeam}) ` +
          `missing=${missing.length} extra=${extra.length}` +
          (missing[0] ? ` e.g. missing ${missing[0]}` : "") +
          (extra[0] ? ` e.g. extra ${extra[0]}` : "")
      );
    }
    checked++;
  }

  if (failures.length > 0) {
    console.error(`FAIL — ${failures.length}/${checked} feeds have mapping gaps:\n`);
    for (const line of failures) console.error(`  ${line}`);
    process.exit(1);
  }

  console.log(`OK — ${checked} feeds: every event maps 1:1 to canvas marks at final minute.`);
}

main();
