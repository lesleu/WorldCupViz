"use client";

import { useEffect, useRef, useState } from "react";
import type p5 from "p5";
import type { MatchData } from "@/data/mockMatch";
import type { MatchStatus } from "@/data/matchCatalog";
import { initialMatchState } from "@/data/mockLiveFeed";
import {
  computeArtworkLayout,
  computeSingleTeamArtworkLayout,
} from "@/design-system/layout/posterLayout";
import { createReplayEngine, type ReplayEngine } from "@/engine/replayEngine";
import type { ReplayControlBundle, ReplayUiState } from "@/engine/replayControls";
import { EMPTY_REPLAY_UI, NOOP_REPLAY_ACTIONS } from "@/engine/replayControls";
import { fetchMatchFeedFromApi } from "@/lib/matches/clientApi";
import { getFeedForMatch } from "@/data/matchFeeds";
import type { MatchFeedResponse } from "@/lib/matches/types";
import { VISUALIZER_CONFIG, cfg } from "@/config";

export type AppMode = "replay" | "live";
export type TeamSide = "home" | "away";

interface MatchVisualizerProps {
  matchId: string;
  match: MatchData | null;
  mode: AppMode;
  matchStatus?: MatchStatus;
  hasReplayFeed?: boolean;
  finalMinute?: number;
  onControls?: (controls: ReplayControlBundle) => void;
  /** Render one team's artwork full-width (mobile stacked panels). */
  teamSide?: TeamSide;
  /** Sync play state from the primary canvas (mobile away panel). */
  replayUi?: ReplayUiState;
  className?: string;
}

type P5Constructor = new (sketch: (p: p5) => void, node?: HTMLElement) => p5;

declare global {
  interface Window {
    p5?: P5Constructor;
  }
}

const P5_SCRIPT_SRC = "/vendor/p5.min.js";
const LIVE_POLL_MS = 20_000;
let p5LoadPromise: Promise<P5Constructor> | null = null;

function loadP5Constructor(): Promise<P5Constructor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("p5 can only load in the browser"));
  }

  if (typeof window.p5 === "function") {
    return Promise.resolve(window.p5);
  }

  if (p5LoadPromise) return p5LoadPromise;

  p5LoadPromise = new Promise<P5Constructor>((resolve, reject) => {
    const finish = () => {
      if (typeof window.p5 === "function") resolve(window.p5);
      else reject(new Error("p5 script loaded but window.p5 is missing"));
    };

    const fail = () => {
      p5LoadPromise = null;
      reject(new Error(`Failed to load ${P5_SCRIPT_SRC}. Run: npm install && npm run dev`));
    };

    const waitForP5 = (script?: HTMLScriptElement) => {
      let attempts = 0;
      const timer = window.setInterval(() => {
        if (typeof window.p5 === "function") {
          window.clearInterval(timer);
          finish();
        } else if (
          attempts++ > 120 ||
          script?.getAttribute("data-error") === "true"
        ) {
          window.clearInterval(timer);
          fail();
        }
      }, 50);
    };

    const existing = document.querySelector(
      `script[src="${P5_SCRIPT_SRC}"]`
    ) as HTMLScriptElement | null;

    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") {
        finish();
        return;
      }
      existing.addEventListener("load", () => {
        existing.setAttribute("data-loaded", "true");
        finish();
      });
      existing.addEventListener("error", () => {
        existing.setAttribute("data-error", "true");
        fail();
      });
      waitForP5(existing);
      return;
    }

    const script = document.createElement("script");
    script.src = P5_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      finish();
    };
    script.onerror = () => {
      script.setAttribute("data-error", "true");
      fail();
    };
    document.head.appendChild(script);
  }).catch((err) => {
    p5LoadPromise = null;
    throw err;
  });

  return p5LoadPromise;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function loadMatchFeed(
  matchId: string,
  matchStatus: MatchStatus,
  sinceMinute?: number
): Promise<MatchFeedResponse> {
  if (matchStatus === "live") {
    return fetchMatchFeedFromApi(matchId, sinceMinute);
  }

  const local = getFeedForMatch(matchId);
  if (local) {
    const feed =
      sinceMinute != null
        ? local.feed.filter((update) => update.minute > sinceMinute)
        : local.feed;
    return {
      ...local,
      feed,
      hasReplayFeed: true,
    };
  }

  const response = await fetch(
    `/api/matches/${encodeURIComponent(matchId)}/feed${
      sinceMinute != null ? `?sinceMinute=${sinceMinute}` : ""
    }`,
    { cache: "force-cache" }
  );
  if (!response.ok) {
    throw new Error(`Failed to load match feed (${response.status})`);
  }
  return response.json() as Promise<MatchFeedResponse>;
}

function resolveFinalMinute(
  feedBundle: MatchFeedResponse,
  finalMinuteProp?: number
): number {
  const maxFromFeed = feedBundle.feed.reduce(
    (max, update) => Math.max(max, update.minute),
    0
  );
  return Math.min(
    cfg.replay.maxMatchMinutes,
    Math.max(
      finalMinuteProp ?? 0,
      feedBundle.currentMinute ?? 0,
      maxFromFeed,
      cfg.replay.regulationMinutes
    )
  );
}

export default function MatchVisualizer({
  matchId,
  match,
  mode,
  matchStatus = "scheduled",
  hasReplayFeed = false,
  finalMinute: finalMinuteProp,
  onControls,
  teamSide,
  replayUi,
  className = "",
}: MatchVisualizerProps) {
  const sketchHostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReplayEngine | null>(null);
  const onControlsRef = useRef(onControls);
  const hasReplayFeedRef = useRef(hasReplayFeed);
  const [initError, setInitError] = useState<string | null>(null);
  const [sketchReady, setSketchReady] = useState(false);

  onControlsRef.current = onControls;
  hasReplayFeedRef.current = hasReplayFeed;

  useEffect(() => {
    const host = sketchHostRef.current;

    if (!host || !match) {
      setSketchReady(false);
      setInitError(null);
      onControlsRef.current?.({
        ...NOOP_REPLAY_ACTIONS,
        ...EMPTY_REPLAY_UI,
      });
      return;
    }

    let mounted = true;
    let retryTimer: number | null = null;
    let uiTimer: ReturnType<typeof setInterval> | null = null;
    let livePollTimer: ReturnType<typeof setInterval> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let p5Instance: p5 | null = null;
    let engine: ReplayEngine | null = null;
    let feedAvailable = false;
    let lastFeedMinute = 0;

    /** In-progress fixture from refreshed API status. */
    const isLiveMatch = matchStatus === "live";
    const isCompletedMatch = matchStatus === "completed";
    const useLiveClock = isLiveMatch;

    const getSize = () => ({
      width: Math.max(sketchHostRef.current?.clientWidth ?? 1, 1),
      height: Math.max(sketchHostRef.current?.clientHeight ?? 1, 1),
    });

    const publish = () => {
      const notify = onControlsRef.current;
      if (!notify || !engine) return;

      notify({
        play: () => {
          if (!feedAvailable && !hasReplayFeedRef.current && !isLiveMatch) return;
          engine?.play();
          p5Instance?.loop();
          publish();
        },
        pause: () => {
          engine?.pause();
          publish();
        },
        reset: () => {
          engine?.reset();
          if (feedAvailable || hasReplayFeedRef.current || isLiveMatch) {
            engine?.play();
          } else {
            engine?.pause();
          }
          p5Instance?.loop();
          publish();
        },
        setSpeed: (speed) => {
          if (!feedAvailable && !hasReplayFeedRef.current && !isLiveMatch) return;
          engine?.setSpeed(speed);
          publish();
        },
        isPlaying: engine.isPlaying,
        minute: engine.minute,
        speed: engine.speed,
        ready: true,
      });
    };

    const teardown = () => {
      p5Instance?.remove();
      p5Instance = null;
      engine = null;
      if (mounted) setSketchReady(false);
    };

    const applyFeedBundle = (bundle: MatchFeedResponse) => {
      if (!engine || bundle.feed.length === 0) return;

      if (isLiveMatch) {
        engine.extendFeed(bundle.feed);
        if (bundle.currentMinute != null) {
          engine.syncLiveMinute(bundle.currentMinute);
        }
        engine.play();
      }

      feedAvailable =
        Boolean(bundle.hasReplayFeed) ||
        bundle.feed.length > 1 ||
        hasReplayFeedRef.current;

      lastFeedMinute = Math.max(
        lastFeedMinute,
        ...bundle.feed.map((update) => update.minute)
      );
    };

    const pollLiveFeed = async () => {
      if (!mounted || !engine || !isLiveMatch) return;
      try {
        const bundle = await loadMatchFeed(matchId, matchStatus, lastFeedMinute);
        applyFeedBundle(bundle);
        publish();
      } catch (error) {
        console.warn("Live feed poll failed:", error);
      }
    };

    const boot = async (attempt = 0) => {
      if (!mounted || !sketchHostRef.current) return;

      const { width, height } = getSize();
      if (width < 32 || height < 32) {
        if (attempt < 120) {
          retryTimer = window.setTimeout(() => void boot(attempt + 1), 50);
        } else if (mounted) {
          setInitError("Canvas area is too small to render. Try widening the window.");
        }
        return;
      }

      try {
        const [P5, { createReplaySketch }, feedBundle] = await Promise.all([
          loadP5Constructor(),
          import("@/design-system/render/posterRenderer"),
          loadMatchFeed(matchId, matchStatus),
        ]);
        if (!mounted || !sketchHostRef.current) return;

        teardown();
        sketchHostRef.current.replaceChildren();

        engine = createReplayEngine(
          feedBundle.feed,
          feedBundle.kickoff ?? initialMatchState
        );
        engineRef.current = engine;
        engine.setLiveClockMode(useLiveClock);
        feedAvailable =
          Boolean(feedBundle.hasReplayFeed) ||
          feedBundle.feed.length > 1 ||
          hasReplayFeedRef.current;

        const layout = computeArtworkLayout(getSize().width, getSize().height);
        const finalMinute = resolveFinalMinute(feedBundle, finalMinuteProp);
        const canReplay = hasReplayFeedRef.current || feedAvailable;

        if (isLiveMatch) {
          if (feedBundle.currentMinute != null) {
            engine.syncLiveMinute(feedBundle.currentMinute);
          }
          engine.play();
        } else if (isCompletedMatch && mode === "live") {
          engine.seekToMinute(finalMinute, layout, match);
          engine.pause();
        } else if (isCompletedMatch && mode === "replay" && canReplay) {
          engine.reset();
          engine.play();
        } else if (canReplay) {
          engine.play();
        } else {
          engine.reset();
          engine.pause();
        }

        lastFeedMinute = Math.max(
          0,
          ...feedBundle.feed.map((update) => update.minute)
        );

        p5Instance = new P5(
          createReplaySketch(match, getSize, () => engine, {
            liveAssetMotion: isLiveMatch,
            artworkOnly: Boolean(teamSide),
            teamSide,
          }),
          sketchHostRef.current
        );

        if (!mounted) {
          p5Instance.remove();
          return;
        }

        setInitError(null);
        setSketchReady(true);

        p5Instance.loop();
        publish();
        uiTimer = setInterval(publish, 250);

        if (isLiveMatch) {
          livePollTimer = setInterval(() => void pollLiveFeed(), LIVE_POLL_MS);
        }
      } catch (error) {
        console.error("Failed to init poster sketch:", error);
        if (mounted) {
          setInitError(`Could not start poster renderer: ${errorMessage(error)}`);
        }
        teardown();
      }
    };

    void boot();

    resizeObserver = new ResizeObserver(() => {
      p5Instance?.windowResized();
    });
    resizeObserver.observe(host);

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (uiTimer) clearInterval(uiTimer);
      if (livePollTimer) clearInterval(livePollTimer);
      resizeObserver?.disconnect();
      p5Instance?.remove();
      p5Instance = null;
      engine = null;
      engineRef.current = null;
    };
  }, [matchId, mode, matchStatus, hasReplayFeed, finalMinuteProp, match, teamSide]);

  useEffect(() => {
    const engine = engineRef.current;
    const host = sketchHostRef.current;
    if (!engine || !host || !match || !replayUi || teamSide !== "away") return;

    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    const layout = computeSingleTeamArtworkLayout(width, height, "away");

    if (engine.speed !== replayUi.speed) {
      engine.setSpeed(replayUi.speed);
    }

    if (Math.abs(engine.minute - replayUi.minute) > 0.12) {
      engine.seekToMinute(replayUi.minute, layout, match);
    }

    if (replayUi.isPlaying && !engine.isPlaying) {
      engine.play();
    } else if (!replayUi.isPlaying && engine.isPlaying) {
      engine.pause();
    }
  }, [match, replayUi, teamSide]);

  const showIdle = !match;

  return (
    <div
      className={`relative h-full min-h-0 w-full overflow-hidden ${className}`}
      style={{ backgroundColor: VISUALIZER_CONFIG.colors.background }}
    >
      <div ref={sketchHostRef} className="absolute inset-0 h-full w-full" />

      {showIdle && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p
            className="text-xs font-bold uppercase tracking-[0.35em]"
            style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
          >
            Match loading…
          </p>
        </div>
      )}

      {!showIdle && !sketchReady && !initError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p
            className="font-mono text-xs uppercase tracking-widest"
            style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
          >
            Starting visualizer…
          </p>
        </div>
      )}

      {initError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center">
          <div className="max-w-md space-y-2">
            <p className="text-sm font-medium" style={{ color: VISUALIZER_CONFIG.colors.redCard }}>
              {initError}
            </p>
            <p className="font-mono text-[10px] leading-relaxed" style={{ color: VISUALIZER_CONFIG.colors.textMuted }}>
              Check the browser console (F12). Run: npm install && rm -rf .next && npm run dev
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
