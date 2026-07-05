/**
 * Verify VAR / disallowed goals remove Goal marks from accumulated art.
 * Run: npm run check:goal-cancellation
 */
import { initialMatchState } from "../src/data/mockLiveFeed";
import type { LiveFeedUpdate } from "../src/data/mockLiveFeed";
import { computeLayout } from "../src/design-system/layout/posterLayout";
import { createReplayEngine } from "../src/engine/replayEngine";
import { getMatchById } from "../src/data/matchCatalog";
import { mapPenaltyAwareEventType } from "../src/lib/matches/penaltyShootout";
import type { ApiFootballEvent, ApiFootballFixture } from "../src/lib/matches/apiFootballClient";
import { deriveTeamStatsFromFeed } from "../src/lib/matches/feedAdapter";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function runReplay(feed: LiveFeedUpdate[]) {
  const entry = getMatchById("2026-group-a-mex-kor");
  if (!entry) throw new Error("demo match missing");

  const engine = createReplayEngine(feed, initialMatchState);
  const layout = computeLayout(1200, 800);
  engine.reset();
  engine.seekToMinute(90, layout, entry.matchData);
  return engine;
}

function main() {
  const feed: LiveFeedUpdate[] = [
    initialMatchState,
    { minute: 50, type: "event", team: "home", eventType: "goal" },
    { minute: 52, type: "event", team: "home", eventType: "goal_cancelled" },
  ];

  const engine = runReplay(feed);
  assert(engine.getSnapshot().art.goals.length === 0, "goal mark removed after cancellation");
  assert(engine.homeGoals === 0, "home goal count decremented after cancellation");

  const stats = deriveTeamStatsFromFeed(feed);
  assert(stats.home.goals === 0, "stats panel goal count nets cancellations");

  const varFixture = {
    fixture: { status: { short: "2H", elapsed: 52 } },
    teams: { home: { id: 1, name: "Mexico" }, away: { id: 2, name: "Korea Republic" } },
    goals: { home: 0, away: 0 },
    league: { round: "Group Stage - A" },
  } as ApiFootballFixture;

  const varEvent: ApiFootballEvent = {
    time: { elapsed: 52, extra: null },
    team: { id: 1, name: "Mexico" },
    type: "Var",
    detail: "Goal cancelled",
  };

  assert(
    mapPenaltyAwareEventType(varEvent, varFixture) === "goal_cancelled",
    "API-Football VAR goal cancelled maps to goal_cancelled"
  );

  const shootoutFeed: LiveFeedUpdate[] = [
    initialMatchState,
    { minute: 121, type: "event", team: "away", eventType: "penalty_scored", sequence: 0 },
    { minute: 122, type: "event", team: "away", eventType: "penalty_cancelled" },
  ];
  const shootoutEngine = runReplay(shootoutFeed);
  assert(
    shootoutEngine.getSnapshot().art.goals.length === 0,
    "penalty shootout goal removed after penalty_cancelled"
  );

  console.log("Goal cancellation checks passed.");
}

main();
