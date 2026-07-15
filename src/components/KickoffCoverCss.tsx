"use client";

import { useEffect, useRef } from "react";
import { drawKickoffCoverText } from "@/design-system/render/kickoffCoverDraw";
import { resolveTeamPalette } from "@/data/teamPaletteFallback";
import { waitForKickoffCanvasFont } from "@/lib/canvasFontReady";

interface KickoffCoverCssProps {
  homeTeamCode: string;
  awayTeamCode: string;
}

/** CSS gradients + canvas stretched team codes — matches kickoff art without per-pixel fills. */
export default function KickoffCoverCss({
  homeTeamCode,
  awayTeamCode,
}: KickoffCoverCssProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const homePalette = resolveTeamPalette(homeTeamCode);
  const awayPalette = resolveTeamPalette(awayTeamCode);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const render = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawKickoffCoverText(ctx, width, height, homeTeamCode, awayTeamCode);
    };

    render();
    void waitForKickoffCanvasFont().then(render);

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [homeTeamCode, awayTeamCode]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full min-w-0 overflow-hidden bg-[#1A1A1A]"
    >
      <div className="absolute inset-0 flex" aria-hidden>
        <div
          className="h-full w-1/2"
          style={{
            background: `linear-gradient(to bottom, ${homePalette.c1}, ${homePalette.c2})`,
          }}
        />
        <div
          className="h-full w-1/2"
          style={{
            background: `linear-gradient(to bottom, ${awayPalette.c1}, ${awayPalette.c2})`,
          }}
        />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden />
    </div>
  );
}
