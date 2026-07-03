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
import {
  HEADER_TITLE_FILL_HEIGHT_RATIO,
  HEADER_TITLE_FILL_WIDTH_RATIO,
  HEADER_TITLE_NATURAL_HEIGHT_SCALE,
  HEADER_TITLE_VERTICAL_CLIP_PADDING,
} from "@/lib/homeHeaderLayout";
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

      const clipPad = compact ? 0 : HEADER_TITLE_VERTICAL_CLIP_PADDING;
      const canvasHeight = height + clipPad * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(canvasHeight * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${canvasHeight}px`;
      canvas.style.top = `${-clipPad}px`;
      canvas.style.left = "0";
      canvas.style.marginTop = "";

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, canvasHeight);

      drawStretchedInterText(
        ctx,
        { left: 0, top: clipPad, width, height },
        {
          text,
          fillStyle: VISUALIZER_CONFIG.colors.text,
          fillWidthRatio: HEADER_TITLE_FILL_WIDTH_RATIO,
          fillHeightRatio: HEADER_TITLE_FILL_HEIGHT_RATIO,
          naturalHeightScale: HEADER_TITLE_NATURAL_HEIGHT_SCALE,
          verticalClipPadding: clipPad,
        }
      );

      const artOptions = { compact };

      ctx.save();
      const clip = headerArtClipRect(width, height, artOptions);
      ctx.beginPath();
      ctx.rect(clip.left, clip.top + clipPad, clip.width, clip.height);
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
          resolved.y + clipPad,
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
      style={{ position: "absolute" }}
      aria-hidden
      role="presentation"
    />
  );
}
