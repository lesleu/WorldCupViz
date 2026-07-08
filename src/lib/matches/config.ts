export interface MatchApiConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  leagueId: number;
  season: number;
}

/** True when an API-Football key is configured (cron + live pulls). */
export function isMatchApiEnabled(): boolean {
  return Boolean(process.env.MATCH_API_KEY?.trim());
}

export function getMatchApiConfig(): MatchApiConfig {
  const apiKey = process.env.MATCH_API_KEY?.trim() ?? "";
  return {
    enabled: isMatchApiEnabled(),
    apiKey,
    baseUrl: (
      process.env.MATCH_API_BASE_URL ?? "https://v3.football.api-sports.io"
    ).replace(/\/$/, ""),
    leagueId: Number(process.env.WC26_LEAGUE_ID ?? "1"),
    season: Number(process.env.WC26_SEASON ?? "2026"),
  };
}

/** Cache TTL (seconds) for schedule list — shorter during live tournament window. */
export function scheduleRevalidateSeconds(): number {
  return Number(process.env.MATCH_SCHEDULE_REVALIDATE ?? "300");
}

/** Cache TTL for completed match feeds (long). Live feeds use 0. */
export function feedRevalidateSeconds(status: "scheduled" | "live" | "completed"): number {
  if (status === "live") return 0;
  if (status === "completed") return Number(process.env.MATCH_FEED_REVALIDATE ?? "3600");
  return 60;
}
