"use client";

import { useEffect, useRef, useState } from "react";
import { VISUALIZER_CONFIG } from "@/config";
import HomeHeaderIntro from "@/components/home/HomeHeaderIntro";
import HomeHeaderTitle from "@/components/home/HomeHeaderTitle";
import {
  HEADER_COMPACT_BOTTOM_PADDING,
  HEADER_HORIZONTAL_PADDING,
  HEADER_TOP_PADDING,
  HEADER_TRANSITION,
  headerLayoutScale,
} from "@/lib/homeHeaderLayout";

interface HomeStickyHeaderProps {
  titleWidth: number;
  canvasHeight: number;
  introWidth: number;
  compactHeaderHeight: number;
  expandedHeaderHeight: number;
  compact: boolean;
  onExpandedHeightChange: (height: number) => void;
}

export default function HomeStickyHeader({
  titleWidth,
  canvasHeight,
  introWidth,
  compactHeaderHeight,
  expandedHeaderHeight,
  compact,
  onExpandedHeightChange,
}: HomeStickyHeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const titleBoxRef = useRef<HTMLDivElement>(null);
  const compactBottomPadding = Math.max(
    8,
    Math.round(
      HEADER_COMPACT_BOTTOM_PADDING *
        headerLayoutScale(titleWidth + HEADER_HORIZONTAL_PADDING)
    )
  );
  const artHeight = compact
    ? Math.max(
        compactHeaderHeight - HEADER_TOP_PADDING - compactBottomPadding,
        1
      )
    : canvasHeight;
  const [titleSize, setTitleSize] = useState({
    width: titleWidth,
    height: artHeight,
  });

  useEffect(() => {
    const box = titleBoxRef.current;
    if (!box) return;

    const updateSize = () => {
      const width = Math.max(box.clientWidth, 1);
      const height = Math.max(box.clientHeight, 1);
      setTitleSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(box);
    return () => observer.disconnect();
  }, [titleWidth, artHeight]);

  useEffect(() => {
    if (compact) return;

    const header = headerRef.current;
    if (!header) return;

    const reportHeight = () => {
      onExpandedHeightChange(Math.ceil(header.scrollHeight));
    };

    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, [compact, canvasHeight, introWidth, artHeight, onExpandedHeightChange]);

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-50 flex w-full flex-col items-center border-b-2 px-3"
      style={{
        height: compact ? compactHeaderHeight : "auto",
        minHeight: compact ? undefined : expandedHeaderHeight,
        paddingTop: HEADER_TOP_PADDING,
        paddingBottom: compact ? compactBottomPadding : undefined,
        boxSizing: "border-box",
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        borderColor: "rgba(234, 234, 234, 0.2)",
        transition: compact ? `height ${HEADER_TRANSITION}` : undefined,
        overflow: compact ? "hidden" : "visible",
      }}
    >
      <h1 className="sr-only">World Cup 2026</h1>
      <div
        ref={titleBoxRef}
        className="relative w-full min-w-0 shrink-0 overflow-hidden"
        style={{
          height: artHeight,
          width: "100%",
          maxWidth: titleWidth,
          transition: `height ${HEADER_TRANSITION}`,
        }}
      >
        <HomeHeaderTitle
          text="WORLD CUP 2026"
          width={titleSize.width}
          height={titleSize.height}
          compact={compact}
          className="pointer-events-none absolute left-0 top-0 block"
        />
      </div>
      <HomeHeaderIntro compact={compact} width={introWidth} />
    </header>
  );
}
