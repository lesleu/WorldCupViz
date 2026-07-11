/**
 * Verify on-demand live-detection window boundaries.
 * Run: npm run check:live-window
 */
import {
  LIVE_WINDOW_AFTER_MS,
  LIVE_WINDOW_BEFORE_MS,
  isWithinLiveWindow,
} from "../src/lib/matches/liveWindow";

const NOW = Date.parse("2026-06-11T18:00:00.000Z");
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

interface Case {
  name: string;
  entry: { status: "scheduled" | "live" | "completed"; kickoffAt?: string };
  expected: boolean;
}

const cases: Case[] = [
  {
    name: "live status is always in-window",
    entry: { status: "live", kickoffAt: iso(-10 * 24 * 60 * 60_000) },
    expected: true,
  },
  {
    name: "completed status is never in-window",
    entry: { status: "completed", kickoffAt: iso(0) },
    expected: false,
  },
  {
    name: "scheduled, kickoff right now",
    entry: { status: "scheduled", kickoffAt: iso(0) },
    expected: true,
  },
  {
    name: "scheduled, just inside the early lead",
    entry: { status: "scheduled", kickoffAt: iso(LIVE_WINDOW_BEFORE_MS - 60_000) },
    expected: true,
  },
  {
    name: "scheduled, before the early lead",
    entry: { status: "scheduled", kickoffAt: iso(LIVE_WINDOW_BEFORE_MS + 60_000) },
    expected: false,
  },
  {
    name: "scheduled, deep into the match (2h in)",
    entry: { status: "scheduled", kickoffAt: iso(-2 * 60 * 60_000) },
    expected: true,
  },
  {
    name: "scheduled, just inside the trailing window",
    entry: { status: "scheduled", kickoffAt: iso(-(LIVE_WINDOW_AFTER_MS - 60_000)) },
    expected: true,
  },
  {
    name: "scheduled, after the trailing window",
    entry: { status: "scheduled", kickoffAt: iso(-(LIVE_WINDOW_AFTER_MS + 60_000)) },
    expected: false,
  },
  {
    name: "scheduled, missing kickoff time",
    entry: { status: "scheduled" },
    expected: false,
  },
  {
    name: "scheduled, unparseable kickoff time",
    entry: { status: "scheduled", kickoffAt: "not-a-date" },
    expected: false,
  },
];

let failures = 0;
for (const testCase of cases) {
  const actual = isWithinLiveWindow(testCase.entry, NOW);
  const ok = actual === testCase.expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.name} (expected ${testCase.expected}, got ${actual})`);
}

if (failures > 0) {
  console.error(`\n${failures} live-window case(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${cases.length} live-window cases passed.`);
