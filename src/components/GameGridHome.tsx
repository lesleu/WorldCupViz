import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { VISUALIZER_CONFIG } from "@/config";
import HomeMatchBrowser from "@/components/home/HomeMatchBrowser";
import DateMatchSection from "@/components/home/DateMatchSection";
import {
  groupMatchesByDate,
  localDateKey,
  pickScrollTargetGroup,
} from "@/lib/homeDateGroups";

interface GameGridHomeProps {
  initialMatches: MatchCatalogEntry[];
}

export default function GameGridHome({ initialMatches }: GameGridHomeProps) {
  const todayKey = localDateKey();
  const dateGroups = groupMatchesByDate(initialMatches, todayKey);
  const scrollTarget = pickScrollTargetGroup(dateGroups, todayKey);
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
