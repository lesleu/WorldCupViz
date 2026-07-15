import {
  isListedMatch,
  type MatchCatalogEntry,
} from "@/data/matchCatalog";

const CACHE_KEY = "wc-vizi-home-matches";

export function writeHomeMatchesCache(matches: MatchCatalogEntry[]): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify(matches.filter(isListedMatch))
    );
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
    if (!Array.isArray(parsed)) return null;

    // Drop stale TBD placeholders cached before real Sat/Sun fixtures landed.
    const listed = parsed.filter(isListedMatch);
    return listed.length > 0 ? listed : null;
  } catch {
    return null;
  }
}
