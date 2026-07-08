import type { MatchCatalogEntry } from "@/data/matchCatalog";
import KickoffCoverCss from "@/components/KickoffCoverCss";
import LazyInView from "@/components/LazyInView";
import TbdCoverPreview from "@/components/TbdCoverPreview";

interface MatchCardCoverProps {
  entry: MatchCatalogEntry;
}

export default function MatchCardCover({ entry }: MatchCardCoverProps) {
  if (entry.isTbd) {
    return <TbdCoverPreview />;
  }

  return (
    <LazyInView>
      <KickoffCoverCss
        homeTeamCode={entry.homeTeamCode}
        awayTeamCode={entry.awayTeamCode}
      />
    </LazyInView>
  );
}
