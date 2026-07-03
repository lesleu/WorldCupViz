import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { formatKickoffFromIso } from "@/lib/matchScheduleFormat";

/** Ensure card kickoff labels exist when ISO datetime is available. */
export function enrichCatalogEntryKickoff(entry: MatchCatalogEntry): MatchCatalogEntry {
  if (entry.kickoffTime) return entry;
  if (!entry.kickoffAt) return entry;

  const { kickoffTime } = formatKickoffFromIso(entry.kickoffAt);
  return { ...entry, kickoffTime };
}

export function enrichCatalogKickoff(
  entries: MatchCatalogEntry[]
): MatchCatalogEntry[] {
  return entries.map(enrichCatalogEntryKickoff);
}
