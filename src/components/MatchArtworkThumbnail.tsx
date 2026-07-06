"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import KickoffCoverPreview from "@/components/KickoffCoverPreview";
import { cfg } from "@/config";
import { HOME_ARTWORK_THUMBNAILS } from "@/config/home.config";
import type { MatchCatalogEntry } from "@/data/matchCatalog";
import { fetchMatchFeedFromApi } from "@/lib/matches/clientApi";
import { maxFeedMinute } from "@/lib/matches/feedAdapter";
import type { MatchFeedResponse } from "@/lib/matches/types";

const MatchCoverCanvas = dynamic(() => import("@/components/MatchCoverCanvas"), {
  ssr: false,
});

export function shouldShowArtworkThumbnail(entry: MatchCatalogEntry): boolean {
  if (!HOME_ARTWORK_THUMBNAILS) return false;
  if (entry.isTbd) return false;
  return (
    entry.hasReplayFeed &&
    (entry.status === "completed" || entry.status === "live")
  );
}

interface MatchArtworkThumbnailProps {
  entry: MatchCatalogEntry;
}

export default function MatchArtworkThumbnail({ entry }: MatchArtworkThumbnailProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [feed, setFeed] = useState<MatchFeedResponse | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      ([entryObs]) => {
        if (entryObs.isIntersecting) setVisible(true);
      },
      { rootMargin: "320px" }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || feed) return;

    let cancelled = false;
    void fetchMatchFeedFromApi(entry.id, undefined, { cache: "no-store" })
      .then((bundle) => {
        if (!cancelled) setFeed(bundle);
      })
      .catch(() => {
        // Kickoff cover remains visible until/unless feed loads.
      });

    return () => {
      cancelled = true;
    };
  }, [entry.id, feed, visible]);

  const frozenMinute =
    entry.finalMinute ??
    (feed ? maxFeedMinute(feed.feed) : undefined) ??
    cfg.replay.regulationMinutes;

  const showArtwork = feed != null && (feed.hasReplayFeed || feed.feed.length > 1);

  return (
    <div
      ref={hostRef}
      className="relative aspect-video w-full min-w-0 overflow-hidden bg-[#121212]"
    >
      {showArtwork ? (
        <MatchCoverCanvas
          matchId={entry.id}
          match={entry.matchData}
          homeTeamCode={entry.homeTeamCode}
          awayTeamCode={entry.awayTeamCode}
          feed={feed}
          frozenMinute={frozenMinute}
          eager
        />
      ) : (
        <KickoffCoverPreview
          homeTeamCode={entry.homeTeamCode}
          awayTeamCode={entry.awayTeamCode}
        />
      )}
    </div>
  );
}
