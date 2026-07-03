"use client";

import { useEffect, useRef } from "react";
import { COMPONENT_PATHS } from "@/design-system/assets/componentPaths.generated";
import { VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";
import { drawSvgComponent2d } from "@/design-system/render/canvasSvgRenderer";
import {
  LEGEND_NEUTRAL_PALETTE,
  legendIconColorOverrides,
  possessionLegendColor,
} from "@/lib/statLegendColors";

const ICON_PX_DEFAULT = 20;

interface StatRowIconProps {
  component: VisualComponent | null;
  size?: number;
}

export default function StatRowIcon({ component, size = ICON_PX_DEFAULT }: StatRowIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPossession = component === VISUAL_COMPONENT.PossessionGrid;
  const hasSvg = Boolean(component && COMPONENT_PATHS[component]);
  const shouldRender = isPossession || hasSvg;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shouldRender) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    if (isPossession) {
      const radius = size * 0.38;
      ctx.fillStyle = possessionLegendColor();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (!component || !hasSvg) return;

    drawSvgComponent2d(
      ctx,
      component,
      LEGEND_NEUTRAL_PALETTE,
      size / 2,
      size / 2,
      {
        widthPx: size,
        heightPx: size,
        colorOverrides: legendIconColorOverrides(component),
      }
    );
  }, [component, hasSvg, isPossession, shouldRender, size]);

  if (!shouldRender) {
    return <span className="inline-block w-5 shrink-0" aria-hidden />;
  }

  return (
    <canvas
      ref={canvasRef}
      className="inline-block shrink-0"
      aria-hidden
      role="presentation"
    />
  );
}
