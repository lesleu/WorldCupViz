import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { formatKickoffFromIso } from "@/lib/matchScheduleFormat";

/** Re-derive Eastern date/time labels from ISO kickoff when available. */
export function enrichCatalogEntryKickoff(entry: MatchCatalogEntry): MatchCatalogEntry {
  if (!entry.kickoffAt) return entry;

  const { date, dateSort, kickoffTime } = formatKickoffFromIso(entry.kickoffAt);

  return {
    ...entry,
    date,
    dateSort,
    kickoffTime,
    matchData: {
      ...entry.matchData,
      date,
    },
  };
}

export function enrichCatalogKickoff(
  entries: MatchCatalogEntry[]
): MatchCatalogEntry[] {
  return entries.map(enrichCatalogEntryKickoff);
}
