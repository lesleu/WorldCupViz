"use client";

import { usePathname } from "next/navigation";
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
  // Always prefer the server schedule for identity/roster — session cache can
  // still hold Saturday/Sunday TBD stubs from earlier deploys.
  if (scrollMode === "restore") {
    const cached = readHomeMatchesCache();
    if (cached && cached.length > 0 && cached.length === initialMatches.length) {
      const serverIds = new Set(initialMatches.map((m) => m.id));
      const cacheIds = new Set(cached.map((m) => m.id));
      const sameIds =
        serverIds.size === cacheIds.size &&
        [...serverIds].every((id) => cacheIds.has(id));
      if (sameIds) return cached;
    }
  }
  return initialMatches;
}

/** Homepage client shell — match list is server-rendered from static schedule JSON. */
export default function HomePageClient({ initialMatches }: HomePageClientProps) {
  const pathname = usePathname();
  const [scrollMode, setScrollMode] = useState<HomeScrollInitMode>(() =>
    resolveHomeScrollInitMode()
  );
  const [matches, setMatches] = useState<MatchCatalogEntry[]>(() =>
    resolveInitialMatches(scrollMode, initialMatches)
  );

  useLayoutEffect(() => {
    if (pathname !== "/") return;

    const mode = resolveHomeScrollInitMode();
    setScrollMode(mode);
    setMatches(resolveInitialMatches(mode, initialMatches));

    if (mode === "today") {
      clearHomeNavigationFlags();
      clearHomeScrollState();
    } else {
      writeHomeMatchesCache(resolveInitialMatches(mode, initialMatches));
    }
  }, [pathname, initialMatches]);

  return (
    <GameGridHome
      initialMatches={matches}
      scrollMode={scrollMode}
    />
  );
}
