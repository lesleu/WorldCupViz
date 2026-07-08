import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { VISUALIZER_CONFIG } from "@/config";
import GameCard from "@/components/GameCard";

interface DateMatchSectionProps {
  id: string;
  label: string;
  stageLabel: string;
  matches: MatchCatalogEntry[];
}

export default function DateMatchSection({
  id,
  label,
  stageLabel,
  matches,
}: DateMatchSectionProps) {
  if (matches.length === 0 && label !== "Today") return null;

  return (
    <section
      id={id}
      className="space-y-6 px-6 py-10"
      style={{ scrollMarginTop: "var(--home-header-height, 400px)" }}
    >
      <div
        className="border-b pb-3"
        style={{ borderColor: "rgba(234, 234, 234, 0.2)" }}
      >
        <div className="flex items-baseline justify-between gap-6">
          <h2
            className="font-[family-name:var(--font-inter-extrabold)] text-[28px] leading-none font-extrabold tracking-[-0.03em]"
            style={{ color: VISUALIZER_CONFIG.colors.text }}
          >
            {label}
          </h2>
          {stageLabel ? (
            <p
              className="shrink-0 text-right font-[family-name:var(--font-inter-extrabold)] text-[28px] leading-none font-extrabold tracking-[-0.03em]"
              style={{ color: VISUALIZER_CONFIG.colors.text }}
            >
              {stageLabel}
            </p>
          ) : null}
        </div>
      </div>
      {matches.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-widest text-[#A39E96]">
          No matches scheduled.
        </p>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matches.map((entry) => (
            <GameCard key={entry.id} entry={entry} hideDateMeta />
          ))}
        </div>
      )}
    </section>
  );
}
