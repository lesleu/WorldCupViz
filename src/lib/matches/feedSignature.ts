import type { LiveFeedUpdate } from "@/data/mockLiveFeed";

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
