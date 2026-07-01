import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { VISUALIZER_CONFIG } from "@/config";
import GameCard from "@/components/GameCard";

interface StageSectionProps {
  label: string;
  matches: MatchCatalogEntry[];
}

export default function StageSection({ label, matches }: StageSectionProps) {
  if (matches.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2
        className="font-mono text-xs uppercase tracking-[0.3em]"
        style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
      >
        {label}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {matches.map((entry) => (
          <GameCard key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}
