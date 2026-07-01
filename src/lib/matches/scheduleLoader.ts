import {
  MATCH_CATALOG,
  TBD_PLACEHOLDER_CATALOG,
  getMatchById as getDemoMatchById,
  type MatchCatalogEntry,
  type TournamentStage,
} from "@/data/matchCatalog";
import {
  SCHEDULE_MATCHES,
  SCHEDULE_SYNCED_AT,
} from "@/data/schedule.generated";

function filterByStage(
  entries: MatchCatalogEntry[],
  stage?: TournamentStage
): MatchCatalogEntry[] {
  return stage ? entries.filter((entry) => entry.stage === stage) : entries;
}

export function hasStaticSchedule(): boolean {
  return SCHEDULE_MATCHES.length > 0;
}

export function getStaticScheduleSyncedAt(): string | null {
  return SCHEDULE_SYNCED_AT;
}

export function getStaticSchedule(stage?: TournamentStage): MatchCatalogEntry[] {
  if (SCHEDULE_MATCHES.length === 0) return [];
  return filterByStage(SCHEDULE_MATCHES, stage);
}

export function getStaticMatchById(id: string): MatchCatalogEntry | undefined {
  const fromSchedule = SCHEDULE_MATCHES.find((entry) => entry.id === id);
  if (fromSchedule) return fromSchedule;

  return (
    getDemoMatchById(id) ??
    TBD_PLACEHOLDER_CATALOG.find((entry) => entry.id === id)
  );
}

export function getDemoCatalog(stage?: TournamentStage): MatchCatalogEntry[] {
  return filterByStage(
    [...MATCH_CATALOG, ...TBD_PLACEHOLDER_CATALOG],
    stage
  );
}
