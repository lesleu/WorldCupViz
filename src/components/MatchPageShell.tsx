"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppMode } from "@/components/MatchVisualizer";
import LiveBadge from "@/components/LiveBadge";
import StatsPanel from "@/components/StatsPanel";
import type { MatchCatalogEntry, MatchStatus } from "@/data/matchCatalog";
import type { MatchData } from "@/data/mockMatch";
import {
  EMPTY_REPLAY_UI,
  NOOP_REPLAY_ACTIONS,
  type ReplayActions,
  type ReplayControlBundle,
  type ReplayUiState,
} from "@/engine/replayControls";
import { fetchMatchFromApi } from "@/lib/matches/clientApi";
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

interface MatchPageShellProps {
  entry: MatchCatalogEntry;
}

export default function MatchPageShell({ entry }: MatchPageShellProps) {
  const [mode, setMode] = useState<AppMode>(
    entry.status === "live" || entry.status === "completed" ? "live" : "replay"
  );
  const [matchStatus, setMatchStatus] = useState<MatchStatus>(entry.status);
  const [matchData, setMatchData] = useState<MatchData>(entry.matchData);
  const [hasReplayFeed, setHasReplayFeed] = useState(entry.hasReplayFeed);
  const [finalMinute, setFinalMinute] = useState(entry.finalMinute);
  const [replayUi, setReplayUi] = useState<ReplayUiState>(EMPTY_REPLAY_UI);
  const replayActionsRef = useRef<ReplayActions>(NOOP_REPLAY_ACTIONS);
  const prevStatusRef = useRef<MatchStatus>(entry.status);

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
    let cancelled = false;

    const refresh = async () => {
      try {
        const updated = await fetchMatchFromApi(entry.id);
        if (!cancelled && updated) {
          setMatchData(updated.matchData);
          setMatchStatus(updated.status);
          setHasReplayFeed(updated.hasReplayFeed);
          setFinalMinute(updated.finalMinute);
        }
      } catch (error) {
        console.warn("Match refresh failed:", error);
      }
    };

    void refresh();
    const timer = setInterval(() => void refresh(), MATCH_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [entry.id]);

  useEffect(() => {
    if (prevStatusRef.current !== "live" && matchStatus === "live") {
      setMode("live");
    }
    if (matchStatus === "completed" && prevStatusRef.current !== "completed") {
      setMode("live");
    }
    prevStatusRef.current = matchStatus;
  }, [matchStatus]);

  return (
    <main
      className="relative flex h-screen w-screen overflow-hidden"
      style={{
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        color: VISUALIZER_CONFIG.colors.text,
      }}
    >
      <div className="absolute left-4 top-4 z-30 flex items-center gap-3">
        <Link
          href="/"
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

      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <MatchVisualizer
          matchId={entry.id}
          match={matchData}
          mode={mode}
          matchStatus={matchStatus}
          hasReplayFeed={hasReplayFeed}
          finalMinute={finalMinute}
          onControls={handleControls}
        />
      </div>

      <StatsPanel
        match={matchData}
        mode={mode}
        matchStatus={matchStatus}
        hasReplayFeed={hasReplayFeed}
        replayUi={replayUi}
        replayActions={replayActionsRef}
        onModeChange={setMode}
      />
    </main>
  );
}
