"use client";

import { useEffect, useRef } from "react";
import { drawKickoffCover } from "@/design-system/render/kickoffCoverDraw";
import { resolveTeamPalette } from "@/data/teamPaletteFallback";

interface KickoffCoverPreviewProps {
  homeTeamCode: string;
  awayTeamCode: string;
}

export default function KickoffCoverPreview({
  homeTeamCode,
  awayTeamCode,
}: KickoffCoverPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const homePalette = resolveTeamPalette(homeTeamCode);
    const awayPalette = resolveTeamPalette(awayTeamCode);

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
      drawKickoffCover(
        ctx,
        width,
        height,
        homeTeamCode,
        awayTeamCode,
        homePalette,
        awayPalette
      );
    };

    const boot = async () => {
      await document.fonts?.load("800 64px Inter, sans-serif");
      render();
    };

    void boot();

    const observer = new ResizeObserver(() => render());
    observer.observe(container);
    return () => observer.disconnect();
  }, [homeTeamCode, awayTeamCode]);

  return (
    <div ref={containerRef} className="relative aspect-video w-full bg-[#121212]">
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
    </div>
  );
}
