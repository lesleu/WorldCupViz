"use client";

import { useLayoutEffect, useState } from "react";
import type { MatchCatalogEntry } from "@/data/matchCatalog";
import GameGridHome from "@/components/GameGridHome";
import HomePageSkeleton from "@/components/home/HomePageSkeleton";
import { fetchMatchesFromApi } from "@/lib/matches/clientApi";
import { readHomeMatchesCache } from "@/lib/homeMatchesCache";
import {
  clearHomeNavigationFlags,
  clearHomeScrollState,
  resolveHomeScrollInitMode,
  type HomeScrollInitMode,
} from "@/lib/homeScrollState";

/** Client-loaded homepage — uses session cache for instant back navigation. */
export default function HomePageClient() {
  const [scrollMode] = useState<HomeScrollInitMode>(() => resolveHomeScrollInitMode());
  const [matches, setMatches] = useState<MatchCatalogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    let cancelled = false;

    const finish = (next: MatchCatalogEntry[]) => {
      if (cancelled) return;
      setMatches(next);
      setLoading(false);
    };

    if (scrollMode === "today") {
      clearHomeNavigationFlags();
      clearHomeScrollState();
    }

    if (scrollMode === "restore") {
      const cached = readHomeMatchesCache();
      if (cached && cached.length > 0) {
        finish(cached);
        return;
      }
    }

    void fetchMatchesFromApi()
      .then((response) => finish(response.matches))
      .catch((error) => {
        console.warn("Homepage match list load failed:", error);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scrollMode]);

  if (loading || !matches) {
    return <HomePageSkeleton />;
  }

  return <GameGridHome initialMatches={matches} scrollMode={scrollMode} />;
}
