/**
 * Composition validation helper — logs replay checkpoints for side-by-side review
 * against design-tokens/reference/compositions/MEX-KOR-fulltime.png
 *
 * Run: npx tsx scripts/export-composition-frames.ts
 *
 * In the browser: open /match/2026-group-a-mex-kor, seek to 0 / 45 / 90, screenshot each.
 * Toggle zone debug: set composition.showZoneDebug = true in composition.config.ts
 */

import { cfg } from "../src/config";
import { getFeedForMatch } from "../src/data/matchFeeds";
import { computeArtworkLayout } from "../src/design-system/layout/posterLayout";
import { createReplayEngine } from "../src/engine/replayEngine";
import { MATCH_CATALOG } from "../src/data/matchCatalog";

const DEMO_ID = "2026-group-a-mex-kor";
const CHECKPOINTS = [0, 45, 90] as const;

function main() {
  const entry = MATCH_CATALOG.find((m) => m.id === DEMO_ID);
  const feed = getFeedForMatch(DEMO_ID);
  if (!entry || !feed) {
    console.error(`Demo feed not found: ${DEMO_ID}`);
    process.exit(1);
  }

  const layout = computeArtworkLayout(1920, 1080);
  const engine = createReplayEngine(feed.feed, feed.kickoff);

  console.log("Composition frame export — manual screenshot checkpoints\n");
  console.log(`Reference: design-tokens/reference/compositions/MEX-KOR-fulltime.png`);
  console.log(`Match: ${entry.homeTeam} vs ${entry.awayTeam}`);
  console.log(`Center gap ratio: ${cfg.composition.zones.centerGapWidthRatio}`);
  console.log(`Max overlap: ${cfg.composition.maxOverlapRatio}`);
  console.log(`Timeline Y weight: ${cfg.composition.timelineYWeight}\n`);

  for (const minute of CHECKPOINTS) {
    engine.seekToMinute(minute, layout, entry.matchData);
    const snap = engine.getSnapshot();
    const homeMarks =
      snap.art.shots.length +
      snap.art.goals.length +
      snap.art.fouls.length +
      snap.art.corners.length;
    const awayMarks =
      snap.art.shots.filter((m) => m.side === "away").length +
      snap.art.goals.filter((m) => m.side === "away").length;

    console.log(`— ${minute}' —`);
    console.log(`  possession: ${snap.continuous.home.possession}% / ${snap.continuous.away.possession}%`);
    console.log(`  home event marks (sample): ${homeMarks}`);
    console.log(`  away goals+shots: ${awayMarks}`);
    console.log(`  Open match page, seek to ${minute}', compare to reference.\n`);
  }

  console.log("Tip: enable composition.showZoneDebug to verify grid vs mark regions.");
}

main();
