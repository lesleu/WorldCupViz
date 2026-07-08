"use client";

import KickoffCoverPreview from "@/components/KickoffCoverPreview";
import type { MatchCatalogEntry } from "@/data/matchCatalog";

/** Homepage cards always use kickoff team gradients (no feed fetch, no p5). */
export function shouldShowArtworkThumbnail(_entry: MatchCatalogEntry): boolean {
  return false;
}

interface MatchArtworkThumbnailProps {
  entry: MatchCatalogEntry;
}

export default function MatchArtworkThumbnail({ entry }: MatchArtworkThumbnailProps) {
  return (
    <KickoffCoverPreview
      homeTeamCode={entry.homeTeamCode}
      awayTeamCode={entry.awayTeamCode}
    />
  );
}
