import type { LiveFeedUpdate } from "@/data/mockLiveFeed";
import type { MatchFeedResponse } from "@/lib/matches/types";

/**
 * Stable identity for feed rows across live polls.
 * Must NOT include array index — extendFeed re-sorts and polls re-send the full
 * feed; index-based keys caused every foul/shot to be applied again each poll.
 */
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

  // Sequenced events (stat synthesis / shootout) keep identity when minutes reshuffle.
  if (update.sequence != null) {
    return ["event", update.team, update.eventType, `seq:${update.sequence}`].join(":");
  }

  return [
    "event",
    update.team,
    update.eventType,
    `min:${update.minute}`,
  ].join(":");
}

/** Cheap revision token so visualizers reboot when polled feed gains replay content. */
export function feedBundleSignature(feed: MatchFeedResponse | null | undefined): string {
  if (!feed) return "none";
  const events = feed.feed.filter((update) => update.type === "event").length;
  // Omit currentMinute — live clock ticks must not reboot the canvas.
  return `${feed.feed.length}:${events}:${feed.hasReplayFeed ? 1 : 0}`;
}
