"use client";

import { useEffect, useRef } from "react";
import { cfg, VISUALIZER_CONFIG } from "@/config";
import { drawStretchedInterText } from "@/lib/stretchedInterText";

interface StretchedInterTitleProps {
  text: string;
  width: number;
  height: number;
  className?: string;
  fillStyle?: string;
}

export default function StretchedInterTitle({
  text,
  width,
  height,
  className,
  fillStyle = VISUALIZER_CONFIG.colors.text,
}: StretchedInterTitleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        { text, fillStyle }
      );
    };

    const { kickoffCodeFontWeight, kickoffCodeFontFamily } = cfg.typography;
    void document.fonts
      ?.load(`${kickoffCodeFontWeight} 64px ${kickoffCodeFontFamily}`)
      .then(render)
      .catch(render);

    return () => {
      cancelled = true;
    };
  }, [text, width, height, fillStyle]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      role="presentation"
    />
  );
}
