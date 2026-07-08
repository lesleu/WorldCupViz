import type { MatchCatalogEntry } from "@/data/matchCatalog";
import type { LiveStatusPatch, LiveStatusResponse } from "@/lib/matches/liveStatus";

export async function fetchLiveStatusFromApi(): Promise<LiveStatusResponse> {
  const response = await fetch("/api/matches/live-status", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load live status (${response.status})`);
  }
  return response.json() as Promise<LiveStatusResponse>;
}

export function applyLiveStatusPatches(
  matches: MatchCatalogEntry[],
  patches: LiveStatusPatch[]
): MatchCatalogEntry[] {
  if (patches.length === 0) return matches;

  const byId = new Map(patches.map((patch) => [patch.id, patch]));
  let changed = false;

  const next = matches.map((entry) => {
    const patch = byId.get(entry.id);
    if (!patch) return entry;

    const statusChanged = entry.status !== patch.status;
    const replayChanged =
      patch.hasReplayFeed != null && entry.hasReplayFeed !== patch.hasReplayFeed;
    const minuteChanged =
      patch.finalMinute != null && entry.finalMinute !== patch.finalMinute;

    if (!statusChanged && !replayChanged && !minuteChanged) return entry;

    changed = true;
    return {
      ...entry,
      status: patch.status,
      hasReplayFeed: patch.hasReplayFeed ?? entry.hasReplayFeed,
      finalMinute: patch.finalMinute ?? entry.finalMinute,
    };
  });

  return changed ? next : matches;
}
