"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AppMode } from "@/components/MatchVisualizer";
import LiveBadge from "@/components/LiveBadge";
import StatsPanel, {
  MatchModeControls,
  MatchTeamHeader,
  TeamStatsBlock,
} from "@/components/StatsPanel";
import type { MatchCatalogEntry, MatchStatus } from "@/data/matchCatalog";
import type { MatchData } from "@/data/mockMatch";
import { getTeamPalette } from "@/data/mockMatch";
import {
  EMPTY_REPLAY_UI,
  NOOP_REPLAY_ACTIONS,
  type ReplayActions,
  type ReplayControlBundle,
  type ReplayUiState,
} from "@/engine/replayControls";
import { fetchMatchFeedFromApi, fetchMatchFromApi } from "@/lib/matches/clientApi";
import { mergeMatchDataWithFeedStats } from "@/lib/matches/feedAdapter";
import { feedBundleSignature } from "@/lib/matches/feedSignature";
import { markHomeReturningFromMatch } from "@/lib/homeScrollState";
import type { MatchFeedResponse } from "@/lib/matches/types";
import { VISUALIZER_CONFIG } from "@/config";

const MatchVisualizer = dynamic(() => import("@/components/MatchVisualizer"), {
  ssr: false,
  loading: () => (
    <div
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden"
      style={{ backgroundColor: VISUALIZER_CONFIG.colors.background }}
    >
      <p
        className="font-mono text-xs uppercase tracking-widest"
        style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
      >
        Loading visualizer…
      </p>
    </div>
  ),
});

const MATCH_POLL_MS = 20_000;
const MOBILE_MAX_WIDTH_PX = 614;
const panelBorder = "rgba(234, 234, 234, 0.15)";

/** Mobile-first — avoids blank mobile first paint and mounting desktop p5 on phones. */
function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(true);

  useLayoutEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return mobile;
}

interface MatchPageShellProps {
  entry: MatchCatalogEntry;
  initialFeed: MatchFeedResponse;
}

export default function MatchPageShell({ entry, initialFeed }: MatchPageShellProps) {
  const [mode, setMode] = useState<AppMode>(
    entry.status === "live" || entry.status === "completed" ? "live" : "replay"
  );
  const [matchStatus, setMatchStatus] = useState<MatchStatus>(entry.status);
  const [matchData, setMatchData] = useState<MatchData>(() =>
    initialFeed.hasReplayFeed || initialFeed.feed.length > 1
      ? mergeMatchDataWithFeedStats(entry.matchData, initialFeed.feed)
      : entry.matchData
  );
  const [feedBundle, setFeedBundle] = useState<MatchFeedResponse>(initialFeed);
  const [hasReplayFeed, setHasReplayFeed] = useState(entry.hasReplayFeed);
  const [finalMinute, setFinalMinute] = useState(entry.finalMinute);
  const [replayUi, setReplayUi] = useState<ReplayUiState>(EMPTY_REPLAY_UI);
  const replayActionsRef = useRef<ReplayActions>(NOOP_REPLAY_ACTIONS);
  const prevStatusRef = useRef<MatchStatus>(entry.status);
  const isMobileLayout = useMobileLayout();

  const handleBackHome = useCallback(() => {
    markHomeReturningFromMatch();
  }, []);

  const handleControls = useCallback((bundle: ReplayControlBundle) => {
    replayActionsRef.current = {
      play: bundle.play,
      pause: bundle.pause,
      reset: bundle.reset,
      setSpeed: bundle.setSpeed,
    };
    setReplayUi({
      isPlaying: bundle.isPlaying,
      minute: bundle.minute,
      speed: bundle.speed,
      ready: bundle.ready,
    });
  }, []);

  useEffect(() => {
    if (matchStatus !== "live") return;

    let cancelled = false;

    const refresh = async () => {
      try {
        const [updated, feed] = await Promise.all([
          fetchMatchFromApi(entry.id),
          fetchMatchFeedFromApi(entry.id),
        ]);
        if (cancelled) return;

        if (feed?.feed?.length) {
          setFeedBundle(feed);
          if (feed.hasReplayFeed) {
            setHasReplayFeed(true);
          }
        }

        if (updated) {
          const baseData = updated.matchData;
          const enriched =
            feed && feed.feed.length > 1
              ? mergeMatchDataWithFeedStats(baseData, feed.feed)
              : baseData;
          setMatchData(enriched);
          setMatchStatus(updated.status);
          setHasReplayFeed(updated.hasReplayFeed);
          setFinalMinute(updated.finalMinute);
        } else if (feed && feed.feed.length > 1) {
          setMatchData((prev) => mergeMatchDataWithFeedStats(prev, feed.feed));
        }
      } catch (error) {
        console.warn("Live match refresh failed:", error);
      }
    };

    void refresh();
    const timer = setInterval(() => void refresh(), MATCH_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [entry.id, matchStatus]);

  useEffect(() => {
    if (mode !== "replay" || !feedBundle || feedBundle.feed.length <= 1) return;

    setMatchData((prev) =>
      mergeMatchDataWithFeedStats(prev, feedBundle.feed, replayUi.minute)
    );
  }, [mode, feedBundle, replayUi.minute]);

  useEffect(() => {
    if (prevStatusRef.current !== "live" && matchStatus === "live") {
      setMode("live");
    }
    if (matchStatus === "completed" && prevStatusRef.current !== "completed") {
      setMode("live");
    }
    prevStatusRef.current = matchStatus;
  }, [matchStatus]);

  const homePalette = getTeamPalette(matchData.homeTeamCode);
  const awayPalette = getTeamPalette(matchData.awayTeamCode);
  const showPenaltyShootout =
    matchData.home.penaltyShootoutScored > 0 ||
    matchData.home.penaltyShootoutMissed > 0 ||
    matchData.away.penaltyShootoutScored > 0 ||
    matchData.away.penaltyShootoutMissed > 0;

  const visualizerProps = {
    matchId: entry.id,
    match: matchData,
    mode,
    matchStatus,
    hasReplayFeed,
    finalMinute,
    feedHint: feedBundle,
    feedRevision: feedBundleSignature(feedBundle),
  };

  return (
    <main
      className="flex min-h-screen w-screen flex-col overflow-y-auto min-[615px]:h-screen min-[615px]:flex-row min-[615px]:overflow-hidden"
      style={{
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        color: VISUALIZER_CONFIG.colors.text,
      }}
    >
      {/* Mobile: back + team header */}
      <header
        className="sticky top-0 z-30 shrink-0 border-b px-4 py-3 min-[615px]:hidden"
        style={{
          backgroundColor: VISUALIZER_CONFIG.colors.background,
          borderColor: panelBorder,
        }}
      >
        <Link
          href="/"
          onClick={handleBackHome}
          className="inline-flex rounded-md border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition hover:border-white/35"
          style={{
            backgroundColor: VISUALIZER_CONFIG.colors.background,
            color: VISUALIZER_CONFIG.colors.text,
          }}
        >
          ← Back
        </Link>

        <MatchTeamHeader
          match={matchData}
          matchStatus={matchStatus}
          homeAccent={homePalette.c1}
          awayAccent={awayPalette.c1}
        />
      </header>

      {/* Mobile: mode controls + interleaved team art + stats */}
      <div className="flex shrink-0 flex-col min-[615px]:hidden">
        <MatchModeControls
          match={matchData}
          mode={mode}
          matchStatus={matchStatus}
          hasReplayFeed={hasReplayFeed}
          replayUi={replayUi}
          replayActions={replayActionsRef}
          onModeChange={setMode}
        />

        <div
          className="aspect-[4/5] w-full border-b"
          style={{ borderColor: panelBorder }}
        >
          <MatchVisualizer
            {...visualizerProps}
            teamSide="home"
            onControls={handleControls}
            className="h-full"
          />
        </div>

        <div className="border-b p-4" style={{ borderColor: panelBorder }}>
          <TeamStatsBlock
            teamName={matchData.homeTeam}
            stats={matchData.home}
            accent={homePalette.c1}
            teamPalette={homePalette}
            showPenaltyShootout={showPenaltyShootout}
          />
        </div>

        <div
          className="aspect-[4/5] w-full border-b"
          style={{ borderColor: panelBorder }}
        >
          <MatchVisualizer
            {...visualizerProps}
            teamSide="away"
            replayUi={replayUi}
            className="h-full"
          />
        </div>

        <div className="p-4">
          <TeamStatsBlock
            teamName={matchData.awayTeam}
            stats={matchData.away}
            accent={awayPalette.c1}
            teamPalette={awayPalette}
            showPenaltyShootout={showPenaltyShootout}
          />
        </div>
      </div>

      {/* Desktop: full poster + sidebar stats — skip on mobile to avoid extra p5 instances */}
      {!isMobileLayout ? (
      <div className="relative hidden min-h-0 min-w-0 flex-1 flex-col min-[615px]:flex">
        <div className="absolute left-4 top-4 z-30 flex items-center gap-3">
          <Link
            href="/"
            onClick={handleBackHome}
            className="rounded-md border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition hover:border-white/35"
            style={{
              backgroundColor: VISUALIZER_CONFIG.colors.background,
              color: VISUALIZER_CONFIG.colors.text,
            }}
          >
            ← Back
          </Link>
          {matchStatus === "live" && <LiveBadge />}
        </div>

        <MatchVisualizer
          {...visualizerProps}
          onControls={handleControls}
        />
      </div>
      ) : null}

      <StatsPanel
        match={matchData}
        mode={mode}
        matchStatus={matchStatus}
        hasReplayFeed={hasReplayFeed}
        replayUi={replayUi}
        replayActions={replayActionsRef}
        onModeChange={setMode}
        className={isMobileLayout ? "hidden" : "hidden min-[615px]:flex"}
      />
    </main>
  );
}
