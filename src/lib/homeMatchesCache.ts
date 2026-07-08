import type { MatchCatalogEntry } from "@/data/matchCatalog";

const CACHE_KEY = "wc-vizi-home-matches";

export function writeHomeMatchesCache(matches: MatchCatalogEntry[]): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(matches));
  } catch {
    // Ignore quota / private browsing errors.
  }
}

export function readHomeMatchesCache(): MatchCatalogEntry[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as MatchCatalogEntry[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
