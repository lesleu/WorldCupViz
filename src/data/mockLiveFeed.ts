import type { TeamSide } from "@/design-system/state/artState";

/** Stats that change continuously during the match (smoothed, never wiped). */
export interface TeamContinuousState {
  possession: number;
  passAccuracy: number;
  totalPasses: number;
  passesAccurate: number;
}

export interface StateUpdate {
  minute: number;
  type: "state_update";
  home: TeamContinuousState;
  away: TeamContinuousState;
}

export type MatchEventType =
  | "shot"
  | "shot_on_target"
  | "goal"
  | "foul"
  | "corner"
  | "offside"
  | "yellow_card"
  | "red_card"
  | "penalty_scored"
  | "penalty_missed";

export interface MatchEvent {
  minute: number;
  type: "event";
  team: TeamSide;
  eventType: MatchEventType;
  /** Disambiguates multiple events at the same minute (stat synthesis, API bursts). */
  sequence?: number;
}

export type LiveFeedUpdate = StateUpdate | MatchEvent;

/** Kickoff continuous state — canvas starts balanced and quiet. */
export const initialMatchState: StateUpdate = {
  minute: 0,
  type: "state_update",
  home: {
    possession: 50,
    passAccuracy: 0,
    totalPasses: 0,
    passesAccurate: 0,
  },
  away: {
    possession: 50,
    passAccuracy: 0,
    totalPasses: 0,
    passesAccurate: 0,
  },
};

/** Ordered replay feed for Mexico vs South Korea (mock live data). */
export const matchUpdates: LiveFeedUpdate[] = [
  initialMatchState,
  {
    minute: 8,
    type: "state_update",
    home: { possession: 44, passAccuracy: 72, totalPasses: 62, passesAccurate: 45 },
    away: { possession: 56, passAccuracy: 78, totalPasses: 78, passesAccurate: 61 },
  },
  { minute: 12, type: "event", team: "home", eventType: "shot" },
  { minute: 14, type: "event", team: "away", eventType: "foul" },
  {
    minute: 18,
    type: "state_update",
    home: { possession: 40, passAccuracy: 74, totalPasses: 110, passesAccurate: 81 },
    away: { possession: 60, passAccuracy: 81, totalPasses: 142, passesAccurate: 115 },
  },
  { minute: 22, type: "event", team: "away", eventType: "corner" },
  { minute: 24, type: "event", team: "away", eventType: "shot" },
  { minute: 27, type: "event", team: "home", eventType: "shot_on_target" },
  {
    minute: 31,
    type: "state_update",
    home: { possession: 43, passAccuracy: 76, totalPasses: 168, passesAccurate: 128 },
    away: { possession: 57, passAccuracy: 82, totalPasses: 198, passesAccurate: 162 },
  },
  { minute: 34, type: "event", team: "home", eventType: "foul" },
  { minute: 38, type: "event", team: "away", eventType: "offside" },
  { minute: 41, type: "event", team: "home", eventType: "shot" },
  {
    minute: 45,
    type: "state_update",
    home: { possession: 41, passAccuracy: 77, totalPasses: 210, passesAccurate: 162 },
    away: { possession: 59, passAccuracy: 83, totalPasses: 248, passesAccurate: 206 },
  },
  { minute: 50, type: "event", team: "home", eventType: "goal" },
  {
    minute: 52,
    type: "state_update",
    home: { possession: 48, passAccuracy: 78, totalPasses: 252, passesAccurate: 197 },
    away: { possession: 52, passAccuracy: 80, totalPasses: 268, passesAccurate: 214 },
  },
  { minute: 55, type: "event", team: "away", eventType: "shot" },
  { minute: 58, type: "event", team: "away", eventType: "shot_on_target" },
  { minute: 61, type: "event", team: "home", eventType: "foul" },
  {
    minute: 64,
    type: "state_update",
    home: { possession: 42, passAccuracy: 77, totalPasses: 298, passesAccurate: 229 },
    away: { possession: 58, passAccuracy: 83, totalPasses: 322, passesAccurate: 267 },
  },
  { minute: 67, type: "event", team: "away", eventType: "corner" },
  { minute: 70, type: "event", team: "home", eventType: "shot" },
  { minute: 73, type: "event", team: "home", eventType: "shot_on_target" },
  { minute: 76, type: "event", team: "away", eventType: "foul" },
  { minute: 79, type: "event", team: "home", eventType: "foul" },
  {
    minute: 82,
    type: "state_update",
    home: { possession: 42, passAccuracy: 77, totalPasses: 340, passesAccurate: 262 },
    away: { possession: 58, passAccuracy: 83, totalPasses: 368, passesAccurate: 305 },
  },
  { minute: 84, type: "event", team: "away", eventType: "shot" },
  { minute: 87, type: "event", team: "home", eventType: "shot" },
  { minute: 89, type: "event", team: "away", eventType: "offside" },
];
