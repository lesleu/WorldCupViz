"use client";

import { useEffect, useRef, useState } from "react";
import { VISUALIZER_CONFIG } from "@/config";
import HomeHeaderTitle from "@/components/home/HomeHeaderTitle";
import {
  HEADER_TOP_PADDING,
  HEADER_TRANSITION,
} from "@/lib/homeHeaderLayout";

interface HomeStickyHeaderProps {
  titleWidth: number;
  headerHeight: number;
  compact: boolean;
}

export default function HomeStickyHeader({
  titleWidth,
  headerHeight,
  compact,
}: HomeStickyHeaderProps) {
  const titleBoxRef = useRef<HTMLDivElement>(null);
  const artHeight = Math.max(headerHeight - HEADER_TOP_PADDING, 1);
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

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex w-full flex-col items-center border-b px-3"
      style={{
        height: headerHeight,
        paddingTop: HEADER_TOP_PADDING,
        boxSizing: "border-box",
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        borderColor: "rgba(234, 234, 234, 0.2)",
        transition: `height ${HEADER_TRANSITION}`,
      }}
    >
      <h1 className="sr-only">World Cup 2026</h1>
      <div
        ref={titleBoxRef}
        className="w-full overflow-hidden"
        style={{
          height: artHeight,
          maxWidth: titleWidth,
          transition: `height ${HEADER_TRANSITION}`,
        }}
      >
        <HomeHeaderTitle
          text="WORLD CUP 2026"
          width={titleSize.width}
          height={titleSize.height}
          compact={compact}
          className="pointer-events-none block h-full w-full"
        />
      </div>
    </header>
  );
}
