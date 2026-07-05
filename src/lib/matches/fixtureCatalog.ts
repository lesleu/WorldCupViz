import type { MatchCatalogEntry } from "@/data/matchCatalog";
import type { ApiFootballFixture } from "@/lib/matches/apiFootballClient";
import { adaptFixtureToCatalogEntry } from "@/lib/matches/matchAdapter";

export function fixturesToCatalogEntries(
  fixtures: ApiFootballFixture[]
): MatchCatalogEntry[] {
  const dropped: string[] = [];

  const entries = fixtures
    .map((fixture) => {
      try {
        return adaptFixtureToCatalogEntry(fixture);
      } catch (error) {
        const home = fixture.teams.home.name;
        const away = fixture.teams.away.name;
        dropped.push(
          `${fixture.fixture.id} (${home} vs ${away}): ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return null;
      }
    })
    .filter((entry): entry is MatchCatalogEntry => entry !== null)
    .sort((a, b) => a.dateSort.localeCompare(b.dateSort));

  if (dropped.length > 0) {
    console.warn(
      `Dropped ${dropped.length} fixture(s) during catalog mapping:\n${dropped.join("\n")}`
    );
  }

  return entries;
}

export function mergeCatalogEntries(
  base: MatchCatalogEntry[],
  incoming: MatchCatalogEntry[]
): MatchCatalogEntry[] {
  const byId = new Map<string, MatchCatalogEntry>();
  for (const entry of base) byId.set(entry.id, entry);
  for (const entry of incoming) {
    const existing = byId.get(entry.id);
    if (existing) {
      byId.set(entry.id, mergeCatalogEntryWithApi(existing, entry));
    } else {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()];
}

/** Prefer API status/scores for fixtures already in the static schedule. */
export function mergeCatalogEntryWithApi(
  base: MatchCatalogEntry,
  api: MatchCatalogEntry
): MatchCatalogEntry {
  const status =
    api.status === "live" || api.status === "completed"
      ? api.status
      : base.status;

  return {
    ...base,
    status,
    finalMinute: api.finalMinute ?? base.finalMinute,
    hasReplayFeed: api.hasReplayFeed || base.hasReplayFeed,
    matchData: api.matchData,
    homeTeam: api.homeTeam || base.homeTeam,
    awayTeam: api.awayTeam || base.awayTeam,
    homeTeamCode: api.homeTeamCode || base.homeTeamCode,
    awayTeamCode: api.awayTeamCode || base.awayTeamCode,
    venue: api.venue ?? base.venue,
    date: api.date || base.date,
    dateSort: api.dateSort || base.dateSort,
    kickoffAt: api.kickoffAt || base.kickoffAt,
    kickoffTime: api.kickoffTime || base.kickoffTime,
  };
}
