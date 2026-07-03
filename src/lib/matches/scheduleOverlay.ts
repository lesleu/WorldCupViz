import type { MatchCatalogEntry } from "@/data/matchCatalog";
import type { ApiFootballFixture } from "@/lib/matches/apiFootballClient";
import { adaptFixtureToCatalogEntry } from "@/lib/matches/matchAdapter";
import {
  getScheduleOverlay,
  type ScheduleOverlayEntry,
} from "@/lib/matches/runtimeStore";

export function overlayEntryFromFixture(
  fixture: ApiFootballFixture
): ScheduleOverlayEntry | null {
  try {
    const entry = adaptFixtureToCatalogEntry(fixture);
    return {
      status: entry.status,
      finalMinute: entry.finalMinute,
      hasReplayFeed: entry.hasReplayFeed,
      matchData: entry.matchData,
    };
  } catch {
    return null;
  }
}

export function mergeEntryWithOverlay(
  base: MatchCatalogEntry,
  overlay?: ScheduleOverlayEntry
): MatchCatalogEntry {
  if (!overlay) return base;

  return {
    ...base,
    status: overlay.status ?? base.status,
    finalMinute: overlay.finalMinute ?? base.finalMinute,
    hasReplayFeed: overlay.hasReplayFeed ?? base.hasReplayFeed,
    matchData: overlay.matchData ?? base.matchData,
  };
}

export async function mergeScheduleWithOverlay(
  entries: MatchCatalogEntry[]
): Promise<MatchCatalogEntry[]> {
  const overlay = await getScheduleOverlay();
  if (Object.keys(overlay).length === 0) return entries;

  return entries.map((entry) => mergeEntryWithOverlay(entry, overlay[entry.id]));
}

export async function getMergedMatchById(
  base: MatchCatalogEntry | undefined
): Promise<MatchCatalogEntry | null> {
  if (!base) return null;

  const overlay = await getScheduleOverlay();
  return mergeEntryWithOverlay(base, overlay[base.id]);
}
