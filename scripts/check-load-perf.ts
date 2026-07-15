import { readFileSync } from "fs";
import { resolve } from "path";
import { createReplayEngine } from "../src/engine/replayEngine";
import { resolveRendererLayout } from "../src/design-system/layout/posterLayout";

const json = JSON.parse(
  readFileSync(resolve("src/data/feeds/1489369.json"), "utf8")
);
const layout = resolveRendererLayout(800, 600, { artworkOnly: false });
const match = {
  homeTeam: "H",
  awayTeam: "A",
  homeTeamCode: "HOM",
  awayTeamCode: "AWY",
  stage: "G",
  date: "d",
  venue: "v",
  home: {
    possession: 61,
    shots: 10,
    shotsOnTarget: 4,
    passAccuracy: 80,
    fouls: 8,
    yellowCards: 1,
    redCards: 0,
    goals: 2,
    corners: 3,
    offsides: 1,
    penaltyShootoutScored: 0,
    penaltyShootoutMissed: 0,
  },
  away: {
    possession: 39,
    shots: 8,
    shotsOnTarget: 3,
    passAccuracy: 75,
    fouls: 6,
    yellowCards: 1,
    redCards: 0,
    goals: 1,
    corners: 2,
    offsides: 1,
    penaltyShootoutScored: 0,
    penaltyShootoutMissed: 0,
  },
};

console.log("start seek");
const t0 = Date.now();
const engine = createReplayEngine(json.feed);
engine.seekToMinute(90, layout, match);
console.log(
  "seek ms",
  Date.now() - t0,
  "circles",
  engine.getSnapshot().art.possessionCircles.length,
  "boxes",
  engine.getSnapshot().art.placement.home.length,
  engine.getSnapshot().art.placement.away.length
);
engine.play();
const t1 = Date.now();
for (let i = 0; i < 60; i++) engine.tick(1 / 30, layout, match);
console.log("60 ticks ms", Date.now() - t1);
