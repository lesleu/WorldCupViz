"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import type { MatchFeedResponse } from "@/lib/matches/types";
import { VISUALIZER_CONFIG } from "@/config";

const MATCH_POLL_MS = 20_000;
const MOBILE_MAX_WIDTH_PX = 614;
const panelBorder = "rgba(234, 234, 234, 0.15)";

type LayoutMode = "mobile" | "desktop";

function useLayoutMode(): LayoutMode | null {
  const [mode, setMode] = useState<LayoutMode | null>(null);

  useLayoutEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);
    const update = () => setMode(query.matches ? "mobile" : "desktop");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return mode;
}

/** Mount heavy canvas children only when scrolled near the viewport. */
function LazyWhenVisible({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "160px 0px" }
    );

    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className={className} style={style}>
      {visible ? children : null}
    </div>
  );
}

interface MatchPageShellProps {
  entry: MatchCatalogEntry;
  initialFeed: MatchFeedResponse;
}

export default function MatchPageShell({ entry, initialFeed }: MatchPageShellProps) {
  const router = useRouter();
  const layoutMode = useLayoutMode();
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

  const isMobile = layoutMode === "mobile";
  const isDesktop = layoutMode === "desktop";

  return (
    <main
      className="flex min-h-screen w-screen flex-col overflow-y-auto min-[615px]:h-screen min-[615px]:flex-row min-[615px]:overflow-hidden"
      style={{
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        color: VISUALIZER_CONFIG.colors.text,
      }}
    >
      {isMobile ? (
        <header
          className="sticky top-0 z-30 shrink-0 border-b px-4 py-3"
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
      ) : null}

      {isMobile ? (
        <div className="flex shrink-0 flex-col">
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

          <LazyWhenVisible
            className="aspect-[4/5] w-full border-b"
            style={{ borderColor: panelBorder }}
          >
            <MatchVisualizer
              {...visualizerProps}
              teamSide="away"
              replayUi={replayUi}
              className="h-full"
            />
          </LazyWhenVisible>

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
      ) : null}

      {isDesktop ? (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
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

      {layoutMode === null ? (
        <div
          className="flex flex-1 items-center justify-center px-6"
          style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
        >
          <p className="font-mono text-xs uppercase tracking-widest">Loading match…</p>
        </div>
      ) : null}

      {isDesktop ? (
        <StatsPanel
          match={matchData}
          mode={mode}
          matchStatus={matchStatus}
          hasReplayFeed={hasReplayFeed}
          replayUi={replayUi}
          replayActions={replayActionsRef}
          onModeChange={setMode}
          className="hidden min-[615px]:flex"
        />
      ) : null}
    </main>
  );
}
