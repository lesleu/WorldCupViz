import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { STAGE_SECTIONS } from "@/data/matchCatalog";
import { VISUALIZER_CONFIG } from "@/config";
import StageSection from "@/components/StageSection";

interface GameGridHomeProps {
  initialMatches: MatchCatalogEntry[];
  dataSource: "static" | "demo";
  syncedAt?: string;
}

function sortStageMatches(matches: MatchCatalogEntry[]): MatchCatalogEntry[] {
  return [...matches].sort((a, b) => {
    if (a.status === "live" && b.status !== "live") return -1;
    if (b.status === "live" && a.status !== "live") return 1;
    return a.dateSort.localeCompare(b.dateSort);
  });
}

export default function GameGridHome({
  initialMatches,
  dataSource,
  syncedAt,
}: GameGridHomeProps) {
  const subtitle =
    dataSource === "static"
      ? syncedAt
        ? `Full tournament schedule (synced ${new Date(syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}). Live scores refresh from the match poll when Redis is configured.`
        : "Full tournament schedule from committed match data. Live scores refresh from the match poll when Redis is configured."
      : "Demo fixtures — run npm run sync:matches when API quota is available to populate the full schedule.";

  const liveCount = initialMatches.filter((entry) => entry.status === "live").length;

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        color: VISUALIZER_CONFIG.colors.text,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10 space-y-2">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.35em]"
            style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
          >
            Match Browser
          </p>
          <h1 className="text-2xl font-semibold md:text-3xl">FIFA World Cup 2026</h1>
          <p
            className="max-w-xl text-sm leading-relaxed"
            style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
          >
            {subtitle}
            {liveCount > 0 && (
              <>
                {" "}
                {liveCount} match{liveCount === 1 ? "" : "es"} marked live in schedule.
              </>
            )}
          </p>
        </header>

        {initialMatches.length === 0 ? (
          <p
            className="font-mono text-xs uppercase tracking-widest"
            style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
          >
            No matches to display.
          </p>
        ) : (
          <div className="space-y-12">
            {STAGE_SECTIONS.map(({ stage, label }) => {
              const stageMatches = sortStageMatches(
                initialMatches.filter((entry) => entry.stage === stage)
              );

              return (
                <StageSection key={stage} label={label} matches={stageMatches} />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
