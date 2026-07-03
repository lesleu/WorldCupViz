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
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}
