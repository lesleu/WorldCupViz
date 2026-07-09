"use client";

import { useLayoutEffect, useState } from "react";
import type { MatchCatalogEntry } from "@/data/matchCatalog";
import GameGridHome from "@/components/GameGridHome";
import {
  clearHomeNavigationFlags,
  clearHomeScrollState,
  resolveHomeScrollInitMode,
  type HomeScrollInitMode,
} from "@/lib/homeScrollState";
import { writeHomeMatchesCache, readHomeMatchesCache } from "@/lib/homeMatchesCache";

interface HomePageClientProps {
  initialMatches: MatchCatalogEntry[];
}

function resolveInitialMatches(
  scrollMode: HomeScrollInitMode,
  initialMatches: MatchCatalogEntry[]
): MatchCatalogEntry[] {
  if (scrollMode === "restore") {
    const cached = readHomeMatchesCache();
    if (cached && cached.length > 0) return cached;
  }
  return initialMatches;
}

/** Homepage client shell — match list is server-rendered from static schedule JSON. */
export default function HomePageClient({ initialMatches }: HomePageClientProps) {
  const [scrollMode] = useState<HomeScrollInitMode>(() => resolveHomeScrollInitMode());
  const [matches] = useState<MatchCatalogEntry[]>(() =>
    resolveInitialMatches(scrollMode, initialMatches)
  );

  useLayoutEffect(() => {
    if (scrollMode === "today") {
      clearHomeNavigationFlags();
      clearHomeScrollState();
    }
    writeHomeMatchesCache(matches);
  }, [matches, scrollMode]);

  return <GameGridHome initialMatches={matches} scrollMode={scrollMode} />;
}
