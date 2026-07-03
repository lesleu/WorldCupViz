"use client";

import type { MatchCatalogEntry } from "@/data/matchCatalog";
import KickoffCoverPreview from "@/components/KickoffCoverPreview";
import TbdCoverPreview from "@/components/TbdCoverPreview";

interface MatchCardCoverProps {
  entry: MatchCatalogEntry;
}

export default function MatchCardCover({ entry }: MatchCardCoverProps) {
  if (entry.isTbd) {
    return <TbdCoverPreview />;
  }

  return (
    <KickoffCoverPreview
      homeTeamCode={entry.homeTeamCode}
      awayTeamCode={entry.awayTeamCode}
    />
  );
}
