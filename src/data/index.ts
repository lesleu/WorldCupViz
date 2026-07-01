export {
  mockMatch,
  paletteForSide,
  getTeamPalette,
  resolveTeamPalette,
  type MatchData,
  type TeamPalette,
  type TeamSide,
  type TeamStats,
} from "./mockMatch";
export {
  MATCH_CATALOG,
  STAGE_SECTIONS,
  getMatchById,
  getMatchesByStage,
  type MatchCatalogEntry,
  type MatchStatus,
  type TournamentStage,
  type StageSection,
} from "./matchCatalog";
export { getFeedForMatch, matchHasReplayFeed, type MatchFeedBundle } from "./matchFeeds";
export {
  TEAMS_BY_CODE,
  TEAM_CODES,
  getTeamByCode,
  getTeamName,
  type Confederation,
  type TeamCode,
  type TeamRecord,
} from "./teams.generated";
export { resolveTeamPalette as resolveTeamPaletteDirect } from "./teamPaletteFallback";
export {
  initialMatchState,
  matchUpdates,
  type LiveFeedUpdate,
  type MatchEvent,
  type MatchEventType,
  type StateUpdate,
  type TeamContinuousState,
} from "./mockLiveFeed";
