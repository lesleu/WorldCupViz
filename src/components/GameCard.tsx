"use client";

import Link from "next/link";
import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { VISUALIZER_CONFIG } from "@/config";
import LiveBadge from "@/components/LiveBadge";
import MatchCardCover from "@/components/MatchCardCover";
import { prepareHomeReturnNavigation } from "@/lib/homeScrollState";

interface GameCardProps {
  entry: MatchCatalogEntry;
  hideDateMeta?: boolean;
}

function CardBody({ entry, hideDateMeta }: GameCardProps) {
  const meta = [
    entry.kickoffTime,
    hideDateMeta ? null : entry.date,
    entry.venue,
  ]
    .filter(Boolean)
    .join(" · ");
  const isTbd = entry.isTbd === true;
  const isLive = entry.status === "live";
  const isScheduled = entry.status === "scheduled" || isTbd;
  const title = isTbd
    ? "Matchup TBD"
    : `${entry.homeTeam} vs ${entry.awayTeam}`;

  return (
    <>
      <div className="relative min-w-0 overflow-hidden">
        {isLive && (
          <div className="absolute left-3 top-3 z-10">
            <LiveBadge />
          </div>
        )}
        <div className={isScheduled ? "opacity-50" : undefined}>
          <MatchCardCover entry={entry} />
        </div>
      </div>

      <div className="space-y-1 px-4 py-3">
        <p
          className="text-sm font-semibold leading-snug"
          style={{
            color: isTbd
              ? VISUALIZER_CONFIG.colors.textMuted
              : VISUALIZER_CONFIG.colors.text,
          }}
        >
          {title}
        </p>
        {meta && (
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
          >
            {meta}
          </p>
        )}
      </div>
    </>
  );
}

export default function GameCard({ entry, hideDateMeta }: GameCardProps) {
  const isTbd = entry.isTbd === true;
  const isLive = entry.status === "live";

  if (isTbd) {
    return (
      <div
        className="block min-w-0 cursor-default overflow-hidden rounded-2xl border border-white/10 opacity-60"
        style={{ backgroundColor: VISUALIZER_CONFIG.colors.background }}
        aria-disabled
      >
        <CardBody entry={entry} hideDateMeta={hideDateMeta} />
      </div>
    );
  }

  return (
    <Link
      href={`/match/${entry.id}`}
      onClick={prepareHomeReturnNavigation}
      className={`group block min-w-0 overflow-hidden rounded-2xl border transition hover:border-white/25 ${
        isLive ? "border-red-500/40" : "border-white/10"
      }`}
      style={{ backgroundColor: VISUALIZER_CONFIG.colors.background }}
    >
      <CardBody entry={entry} hideDateMeta={hideDateMeta} />
    </Link>
  );
}
