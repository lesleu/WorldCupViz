import type { MatchCatalogEntry, TournamentStage } from "@/data/matchCatalog";
import type { MatchFeedResponse, MatchListResponse } from "@/lib/matches/types";

export async function fetchMatchesFromApi(
  stage?: TournamentStage
): Promise<MatchListResponse> {
  const query = stage ? `?stage=${stage}` : "";
  const response = await fetch(`/api/matches${query}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load matches (${response.status})`);
  }
  return response.json() as Promise<MatchListResponse>;
}

export async function fetchMatchFromApi(id: string): Promise<MatchCatalogEntry | null> {
  const response = await fetch(`/api/matches/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load match (${response.status})`);
  }
  const payload = (await response.json()) as { match: MatchCatalogEntry };
  return payload.match;
}

export async function fetchMatchFeedFromApi(
  id: string,
  sinceMinute?: number,
  options?: { cache?: RequestCache; revalidate?: number }
): Promise<MatchFeedResponse> {
  const query =
    sinceMinute != null ? `?sinceMinute=${encodeURIComponent(String(sinceMinute))}` : "";
  const init: RequestInit =
    options?.revalidate != null
      ? { next: { revalidate: options.revalidate } }
      : { cache: options?.cache ?? "no-store" };
  const response = await fetch(
    `/api/matches/${encodeURIComponent(id)}/feed${query}`,
    init
  );
  if (!response.ok) {
    throw new Error(`Failed to load match feed (${response.status})`);
  }
  return response.json() as Promise<MatchFeedResponse>;
}
