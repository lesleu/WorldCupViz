"use client";

import { useEffect, useState } from "react";
import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { HOME_LIVE_POLL_MS } from "@/config/home.config";
import { VISUALIZER_CONFIG } from "@/config";
import HomeMatchBrowser from "@/components/home/HomeMatchBrowser";
import DateMatchSection from "@/components/home/DateMatchSection";
import {
  applyLiveStatusPatches,
  fetchLiveStatusFromApi,
} from "@/lib/homeLiveStatus";
import {
  groupMatchesByDate,
  localDateKey,
  pickScrollTargetGroup,
} from "@/lib/homeDateGroups";

interface GameGridHomeProps {
  initialMatches: MatchCatalogEntry[];
}

export default function GameGridHome({ initialMatches }: GameGridHomeProps) {
  const [matches, setMatches] = useState(initialMatches);
  const todayKey = localDateKey();
  const dateGroups = groupMatchesByDate(matches, todayKey);
  const scrollTarget = pickScrollTargetGroup(dateGroups, todayKey);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      if (document.hidden) return;

      try {
        const result = await fetchLiveStatusFromApi();
        if (cancelled || result.skipped || result.patches.length === 0) return;

        setMatches((prev) => applyLiveStatusPatches(prev, result.patches));
      } catch (error) {
        console.warn("Homepage live status poll failed:", error);
      }
    };

    void poll();
    timer = setInterval(() => void poll(), HOME_LIVE_POLL_MS);

    const onVisibilityChange = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <HomeMatchBrowser scrollTargetDateSort={scrollTarget?.dateSort}>
      {dateGroups.length === 0 ? (
        <p className="px-6 py-16 font-mono text-xs uppercase tracking-widest text-[#A39E96]">
          No matches to display.
        </p>
      ) : (
        dateGroups.map((group) => (
          <DateMatchSection
            key={group.dateSort}
            id={`date-${group.dateSort}`}
            label={group.label}
            stageLabel={group.stageLabel}
            matches={group.matches}
          />
        ))
      )}
      <footer className="px-6 pb-16 pt-8 text-center">
        <a
          href="https://www.instagram.com/solar____beam/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs uppercase tracking-widest underline-offset-4 transition-opacity hover:opacity-80 hover:underline"
          style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
        >
          created by solar____beam
        </a>
      </footer>
    </HomeMatchBrowser>
  );
}
