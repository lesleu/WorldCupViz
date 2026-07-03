"use client";

import { useEffect, useMemo, useRef } from "react";
import { VISUALIZER_CONFIG } from "@/config";
import { drawSvgComponent2d } from "@/design-system/render/canvasSvgRenderer";
import { waitForKickoffCanvasFont } from "@/lib/canvasFontReady";
import {
  buildHomeHeaderArtPlacements,
  headerArtClipRect,
  resolveHomeHeaderArtPlacement,
} from "@/lib/homeHeaderArt";
import { drawStretchedInterText } from "@/lib/stretchedInterText";

interface HomeHeaderTitleProps {
  text: string;
  width: number;
  height: number;
  compact: boolean;
  className?: string;
}

export default function HomeHeaderTitle({
  text,
  width,
  height,
  compact,
  className,
}: HomeHeaderTitleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const placements = useMemo(() => buildHomeHeaderArtPlacements(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    let cancelled = false;

    const render = () => {
      if (cancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      drawStretchedInterText(
        ctx,
        { left: 0, top: 0, width, height },
        { text, fillStyle: VISUALIZER_CONFIG.colors.text }
      );

      const artOptions = { compact };

      ctx.save();
      const clip = headerArtClipRect(width, height, artOptions);
      ctx.beginPath();
      ctx.rect(clip.left, clip.top, clip.width, clip.height);
      ctx.clip();

      for (const placement of placements) {
        const resolved = resolveHomeHeaderArtPlacement(
          placement,
          width,
          height,
          artOptions
        );
        drawSvgComponent2d(
          ctx,
          resolved.component,
          resolved.palette,
          resolved.x,
          resolved.y,
          {
            widthPx: resolved.widthPx,
            heightPx: resolved.heightPx,
          }
        );
      }

      ctx.restore();
    };

    render();
    void waitForKickoffCanvasFont().then(() => {
      if (!cancelled) render();
    });

    return () => {
      cancelled = true;
    };
  }, [text, width, height, compact, placements]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      role="presentation"
    />
  );
}
