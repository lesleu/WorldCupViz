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
      date: entry.date,
      dateSort: entry.dateSort,
      kickoffAt: entry.kickoffAt,
      kickoffTime: entry.kickoffTime,
      venue: entry.venue,
      stage: entry.stage,
      stageLabel: entry.stageLabel,
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      homeTeamCode: entry.homeTeamCode,
      awayTeamCode: entry.awayTeamCode,
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

function catalogEntryFromOverlay(
  matchId: string,
  overlay: ScheduleOverlayEntry
): MatchCatalogEntry | null {
  if (!overlay.matchData || !overlay.dateSort || !overlay.kickoffAt) return null;

  return {
    id: matchId,
    providerFixtureId: Number(matchId),
    tournament: "FIFA World Cup 2026",
    stage: overlay.stage ?? "round_of_32",
    stageLabel: overlay.stageLabel ?? "Round of 32",
    status: overlay.status ?? "scheduled",
    isTbd: false,
    matchNumber: Number(matchId),
    date: overlay.date ?? overlay.matchData.date,
    dateSort: overlay.dateSort,
    kickoffAt: overlay.kickoffAt,
    kickoffTime: overlay.kickoffTime,
    venue: overlay.venue ?? overlay.matchData.venue,
    homeTeam: overlay.homeTeam ?? overlay.matchData.homeTeam,
    awayTeam: overlay.awayTeam ?? overlay.matchData.awayTeam,
    homeTeamCode: overlay.homeTeamCode ?? overlay.matchData.homeTeamCode,
    awayTeamCode: overlay.awayTeamCode ?? overlay.matchData.awayTeamCode,
    finalMinute: overlay.finalMinute,
    hasReplayFeed: overlay.hasReplayFeed ?? false,
    matchData: overlay.matchData,
  };
}

export async function mergeScheduleWithOverlay(
  entries: MatchCatalogEntry[]
): Promise<MatchCatalogEntry[]> {
  const overlay = await getScheduleOverlay();
  if (Object.keys(overlay).length === 0) return entries;

  const byId = new Map<string, MatchCatalogEntry>();
  for (const entry of entries) {
    byId.set(entry.id, mergeEntryWithOverlay(entry, overlay[entry.id]));
  }

  for (const [matchId, patch] of Object.entries(overlay)) {
    if (byId.has(matchId)) continue;
    const discovered = catalogEntryFromOverlay(matchId, patch);
    if (discovered) byId.set(matchId, discovered);
  }

  return [...byId.values()];
}

export async function getMergedMatchById(
  base: MatchCatalogEntry | undefined
): Promise<MatchCatalogEntry | null> {
  const overlay = await getScheduleOverlay();

  if (base) {
    return mergeEntryWithOverlay(base, overlay[base.id]);
  }

  return null;
}

export async function getOverlayDiscoveredMatchById(
  id: string
): Promise<MatchCatalogEntry | null> {
  const overlay = await getScheduleOverlay();
  const patch = overlay[id];
  if (!patch) return null;
  return catalogEntryFromOverlay(id, patch);
}
