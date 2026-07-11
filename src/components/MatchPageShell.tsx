"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import MatchVisualizer, { type AppMode } from "@/components/MatchVisualizer";
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
import { useIsMobileLayout } from "@/lib/useIsMobileLayout";
import type { MatchFeedResponse } from "@/lib/matches/types";
import { VISUALIZER_CONFIG } from "@/config";

const MATCH_POLL_MS = 20_000;
/** Slower poll while waiting for a scheduled match to kick off. */
const PRE_LIVE_POLL_MS = 60_000;
/** Probe for kickoff from ~2 min early to ~3.5h after (ET + penalties). */
const PRE_LIVE_LEAD_MS = 2 * 60_000;
const PRE_LIVE_TRAIL_MS = 3.5 * 60 * 60_000;
const panelBorder = "rgba(234, 234, 234, 0.15)";

interface MatchPageShellProps {
  entry: MatchCatalogEntry;
  initialFeed: MatchFeedResponse;
}

export default function MatchPageShell({ entry, initialFeed }: MatchPageShellProps) {
  const router = useRouter();
  const isMobileLayout = useIsMobileLayout();
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
  const [hasReplayFeed, setHasReplayFeed] = useState(
    entry.hasReplayFeed || initialFeed.hasReplayFeed || initialFeed.feed.length > 1
  );
  const [finalMinute, setFinalMinute] = useState(entry.finalMinute);
  const [replayUi, setReplayUi] = useState<ReplayUiState>(EMPTY_REPLAY_UI);
  const replayActionsRef = useRef<ReplayActions>(NOOP_REPLAY_ACTIONS);
  const prevStatusRef = useRef<MatchStatus>(entry.status);
  /** Stable revision from SSR feed — completed matches should not reboot canvas on poll. */
  const initialFeedRevisionRef = useRef(feedBundleSignature(initialFeed));

  const handleBackHome = useCallback(() => {
    markHomeReturningFromMatch();
    router.push("/");
  }, [router]);

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

  // Scheduled match with the page left open: poll status near kickoff so live
  // art starts automatically without a manual refresh.
  useEffect(() => {
    if (matchStatus !== "scheduled") return;
    const kickoffMs = entry.kickoffAt ? Date.parse(entry.kickoffAt) : NaN;
    if (Number.isNaN(kickoffMs)) return;

    let cancelled = false;

    const checkKickoff = async () => {
      const now = Date.now();
      if (now < kickoffMs - PRE_LIVE_LEAD_MS || now > kickoffMs + PRE_LIVE_TRAIL_MS) {
        return;
      }
      try {
        const updated = await fetchMatchFromApi(entry.id);
        if (cancelled || !updated || updated.status === "scheduled") return;
        setMatchData(updated.matchData);
        setHasReplayFeed(updated.hasReplayFeed);
        setFinalMinute(updated.finalMinute);
        setMatchStatus(updated.status);
      } catch (error) {
        console.warn("Kickoff status check failed:", error);
      }
    };

    void checkKickoff();
    const timer = setInterval(() => void checkKickoff(), PRE_LIVE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [entry.id, entry.kickoffAt, matchStatus]);

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

  const feedRevision = initialFeedRevisionRef.current;

  const visualizerProps = {
    matchId: entry.id,
    match: matchData,
    mode,
    matchStatus,
    hasReplayFeed,
    finalMinute,
    feedHint: feedBundle,
    feedRevision,
    skipLivePoll: true,
  };

  return (
    <main
      className="flex min-h-screen w-full flex-col overflow-y-auto min-[615px]:h-screen min-[615px]:flex-row min-[615px]:overflow-hidden"
      style={{
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        color: VISUALIZER_CONFIG.colors.text,
      }}
    >
      {/* Mobile chrome */}
      <header
        className="sticky top-0 z-30 shrink-0 border-b px-4 py-3 min-[615px]:hidden"
        style={{
          backgroundColor: VISUALIZER_CONFIG.colors.background,
          borderColor: panelBorder,
        }}
      >
        <button
          type="button"
          onClick={handleBackHome}
          className="inline-flex rounded-md border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition hover:border-white/35"
          style={{
            backgroundColor: VISUALIZER_CONFIG.colors.background,
            color: VISUALIZER_CONFIG.colors.text,
            touchAction: "manipulation",
          }}
        >
          ← Back
        </button>

        <MatchTeamHeader
          match={matchData}
          matchStatus={matchStatus}
          homeAccent={homePalette.c1}
          awayAccent={awayPalette.c1}
        />
      </header>

      {/* Mobile: one full poster canvas + stacked stats (single p5 instance) */}
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
          className="relative aspect-[4/5] min-h-[320px] w-full border-b"
          style={{ borderColor: panelBorder }}
        >
          <div className="absolute inset-0">
            <MatchVisualizer
              {...visualizerProps}
              onControls={handleControls}
              className="h-full min-h-[320px]"
            />
          </div>
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

      {/* Desktop: full poster + sidebar — skip on mobile to avoid dual p5 */}
      {!isMobileLayout ? (
        <div className="relative hidden min-h-0 min-w-0 flex-1 flex-col min-[615px]:flex">
          <div className="absolute left-4 top-4 z-30 flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackHome}
              className="rounded-md border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition hover:border-white/35"
              style={{
                backgroundColor: VISUALIZER_CONFIG.colors.background,
                color: VISUALIZER_CONFIG.colors.text,
                touchAction: "manipulation",
              }}
            >
              ← Back
            </button>
            {matchStatus === "live" && <LiveBadge />}
          </div>

          <MatchVisualizer {...visualizerProps} onControls={handleControls} />
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
