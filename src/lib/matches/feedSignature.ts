import type { LiveFeedUpdate } from "@/data/mockLiveFeed";
import type { MatchFeedResponse } from "@/lib/matches/types";

export function feedUpdateSignature(update: LiveFeedUpdate): string {
  if (update.type === "state_update") {
    return [
      "state",
      update.minute,
      update.home.possession,
      update.home.passAccuracy,
      update.away.possession,
      update.away.passAccuracy,
    ].join(":");
  }

  return [
    "event",
    update.minute,
    update.team,
    update.eventType,
    update.sequence ?? 0,
  ].join(":");
}

/** Cheap revision token so visualizers reboot when polled feed gains replay content. */
export function feedBundleSignature(feed: MatchFeedResponse | null | undefined): string {
  if (!feed) return "none";
  const events = feed.feed.filter((update) => update.type === "event").length;
  return `${feed.feed.length}:${events}:${feed.hasReplayFeed ? 1 : 0}:${feed.currentMinute ?? 0}`;
}
