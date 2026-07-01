"use client";

import { useEffect, useRef, useState } from "react";
import type p5 from "p5";
import type { MatchData } from "@/data/mockMatch";
import { computeArtworkLayout } from "@/design-system/layout/posterLayout";
import { createReplayEngine, type ReplayEngine } from "@/engine/replayEngine";
import type { MatchFeedResponse } from "@/lib/matches/types";
import KickoffCoverPreview from "@/components/KickoffCoverPreview";
import { cfg } from "@/config";

type P5Constructor = new (sketch: (p: p5) => void, node?: HTMLElement) => p5;

declare global {
  interface Window {
    p5?: P5Constructor;
  }
}

const P5_SCRIPT_SRC = "/vendor/p5.min.js";
let p5LoadPromise: Promise<P5Constructor> | null = null;

function loadP5Constructor(): Promise<P5Constructor> {
  if (typeof window.p5 === "function") return Promise.resolve(window.p5);
  if (p5LoadPromise) return p5LoadPromise;

  p5LoadPromise = new Promise<P5Constructor>((resolve, reject) => {
    const finish = () => {
      if (typeof window.p5 === "function") resolve(window.p5);
      else reject(new Error("p5 missing"));
    };

    const existing = document.querySelector(
      `script[src="${P5_SCRIPT_SRC}"]`
    ) as HTMLScriptElement | null;

    if (existing?.getAttribute("data-loaded") === "true") {
      finish();
      return;
    }

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = P5_SCRIPT_SRC;
    script.async = true;
    script.onload = () => finish();
    script.onerror = () => reject(new Error("Failed to load p5"));
    document.head.appendChild(script);
  });

  return p5LoadPromise;
}

interface MatchCoverCanvasProps {
  matchId: string;
  match: MatchData;
  homeTeamCode: string;
  awayTeamCode: string;
  feed: MatchFeedResponse;
  frozenMinute?: number;
}

/** Renders a frozen poster frame (e.g. full-time generative art) for card covers. */
export default function MatchCoverCanvas({
  match,
  homeTeamCode,
  awayTeamCode,
  feed,
  frozenMinute = cfg.replay.regulationMinutes,
}: MatchCoverCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "240px" }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !visible || failed) return;

    if (!feed.hasReplayFeed && feed.feed.length <= 1) {
      setFailed(true);
      return;
    }

    let mounted = true;
    let p5Instance: p5 | null = null;
    let engine: ReplayEngine | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const getSize = () => ({
      width: Math.max(host.clientWidth, 1),
      height: Math.max(host.clientHeight, 1),
    });

    const boot = async () => {
      try {
        const [P5, { createReplaySketch }] = await Promise.all([
          loadP5Constructor(),
          import("@/design-system/render/posterRenderer"),
        ]);
        if (!mounted || !hostRef.current) return;

        hostRef.current.replaceChildren();

        const layout = computeArtworkLayout(getSize().width, getSize().height);
        engine = createReplayEngine(feed.feed, feed.kickoff);
        engine.seekToMinute(frozenMinute, layout, match);

        p5Instance = new P5(
          createReplaySketch(match, getSize, () => engine, { artworkOnly: true }),
          hostRef.current
        );

        if (!mounted) {
          p5Instance.remove();
          return;
        }

        p5Instance.loop();
        window.setTimeout(() => p5Instance?.noLoop(), 500);
      } catch {
        if (mounted) setFailed(true);
      }
    };

    void boot();

    resizeObserver = new ResizeObserver(() => {
      p5Instance?.windowResized();
      if (engine && hostRef.current) {
        const layout = computeArtworkLayout(
          hostRef.current.clientWidth,
          hostRef.current.clientHeight
        );
        engine.seekToMinute(frozenMinute, layout, match);
        p5Instance?.redraw();
      }
    });
    resizeObserver.observe(host);

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      p5Instance?.remove();
    };
  }, [match, feed, frozenMinute, visible, failed]);

  if (failed) {
    return (
      <KickoffCoverPreview homeTeamCode={homeTeamCode} awayTeamCode={awayTeamCode} />
    );
  }

  return (
    <div
      ref={hostRef}
      className="aspect-video w-full overflow-hidden bg-[#121212] [&>canvas]:!h-full [&>canvas]:!w-full"
    />
  );
}
