import Image from "next/image";
import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { cfg } from "@/config";
import KickoffCoverPreview from "@/components/KickoffCoverPreview";
import MatchCoverCanvas from "@/components/MatchCoverCanvas";
import TbdCoverPreview from "@/components/TbdCoverPreview";
import { getStaticFeed } from "@/lib/matches/feedLoader";

interface MatchCoverPreviewProps {
  entry: MatchCatalogEntry;
}

function coverFrozenMinute(entry: MatchCatalogEntry): number {
  return entry.finalMinute ?? cfg.replay.regulationMinutes;
}

export default async function MatchCoverPreview({ entry }: MatchCoverPreviewProps) {
  if (entry.isTbd) {
    return <TbdCoverPreview />;
  }
  if (entry.fulltimeCoverUrl && entry.status === "completed") {
    return (
      <Image
        src={entry.fulltimeCoverUrl}
        alt={`${entry.homeTeam} vs ${entry.awayTeam} full time`}
        width={640}
        height={360}
        className="aspect-video w-full object-cover"
      />
    );
  }

  if (entry.status === "completed" && entry.hasReplayFeed) {
    const feed = await getStaticFeed(entry.id);
    if (feed?.hasReplayFeed) {
      return (
        <MatchCoverCanvas
          matchId={entry.id}
          match={entry.matchData}
          homeTeamCode={entry.homeTeamCode}
          awayTeamCode={entry.awayTeamCode}
          frozenMinute={coverFrozenMinute(entry)}
          feed={feed}
        />
      );
    }
  }

  if (entry.coverUrl) {
    return (
      <Image
        src={entry.coverUrl}
        alt={`${entry.homeTeam} vs ${entry.awayTeam}`}
        width={640}
        height={360}
        className="aspect-video w-full object-cover"
      />
    );
  }

  return (
    <KickoffCoverPreview
      homeTeamCode={entry.homeTeamCode}
      awayTeamCode={entry.awayTeamCode}
    />
  );
}
