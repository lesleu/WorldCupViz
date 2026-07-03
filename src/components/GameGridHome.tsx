"use client";

import { useEffect, useState } from "react";
import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { VISUALIZER_CONFIG } from "@/config";
import HomeMatchBrowser from "@/components/home/HomeMatchBrowser";
import DateMatchSection from "@/components/home/DateMatchSection";
import { fetchMatchesFromApi } from "@/lib/matches/clientApi";
import {
  groupMatchesByDate,
  localDateKey,
  pickScrollTargetGroup,
} from "@/lib/homeDateGroups";

const HOME_MATCH_POLL_MS = 20_000;

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

    const refreshMatches = async () => {
      try {
        const { matches: nextMatches } = await fetchMatchesFromApi();
        if (!cancelled) setMatches(nextMatches);
      } catch (error) {
        console.warn("Home match list refresh failed:", error);
      }
    };

    const intervalId = window.setInterval(refreshMatches, HOME_MATCH_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
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
