"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { VISUALIZER_CONFIG } from "@/config";
import HomeStickyHeader from "@/components/home/HomeStickyHeader";
import { REF_HEADER_FULL_HEIGHT } from "@/lib/homeHeaderLayout";
import { homeTitleMetrics } from "@/lib/stretchedInterText";

const SCROLL_DIRECTION_THRESHOLD = 2;
const DEFAULT_VIEWPORT_WIDTH = 1920;

interface HomeMatchBrowserProps {
  children: ReactNode;
  scrollTargetDateSort?: string;
}

export default function HomeMatchBrowser({
  children,
  scrollTargetDateSort,
}: HomeMatchBrowserProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledToToday = useRef(false);
  const lastScrollTopRef = useRef(0);
  const prevCompactRef = useRef(false);
  const expandedHeightRef = useRef(REF_HEADER_FULL_HEIGHT);

  const [viewportWidth, setViewportWidth] = useState(DEFAULT_VIEWPORT_WIDTH);
  const [compactHeader, setCompactHeader] = useState(false);
  const [expandedHeaderHeight, setExpandedHeaderHeight] =
    useState(REF_HEADER_FULL_HEIGHT);

  const { titleWidth, canvasHeight, introWidth, compactHeaderHeight } = useMemo(
    () => homeTitleMetrics(viewportWidth),
    [viewportWidth]
  );

  const headerHeight = compactHeader ? compactHeaderHeight : expandedHeaderHeight;

  const handleExpandedHeightChange = useCallback((height: number) => {
    expandedHeightRef.current = height;
    setExpandedHeaderHeight((prev) => (prev === height ? prev : height));
  }, []);

  useEffect(() => {
    const updateWidth = () => setViewportWidth(window.innerWidth);
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || prevCompactRef.current === compactHeader) return;

    const delta = expandedHeightRef.current - compactHeaderHeight;
    if (compactHeader) {
      scroller.scrollTop = Math.max(0, scroller.scrollTop - delta);
    } else {
      scroller.scrollTop = scroller.scrollTop + delta;
    }

    lastScrollTopRef.current = scroller.scrollTop;
    prevCompactRef.current = compactHeader;
  }, [compactHeader, compactHeaderHeight]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !scrollTargetDateSort || hasScrolledToToday.current) return;

    const target = document.getElementById(`date-${scrollTargetDateSort}`);
    if (!target) return;

    scroller.scrollTop = Math.max(0, target.offsetTop - expandedHeaderHeight);
    lastScrollTopRef.current = scroller.scrollTop;
    hasScrolledToToday.current = true;
    setCompactHeader(false);
    prevCompactRef.current = false;
  }, [expandedHeaderHeight, scrollTargetDateSort]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const current = scroller.scrollTop;
      const previous = lastScrollTopRef.current;
      const delta = current - previous;

      if (current <= 0) {
        setCompactHeader(false);
      } else if (delta > SCROLL_DIRECTION_THRESHOLD) {
        setCompactHeader(true);
      } else if (delta < -SCROLL_DIRECTION_THRESHOLD) {
        setCompactHeader(false);
      }

      lastScrollTopRef.current = current;
    };

    lastScrollTopRef.current = scroller.scrollTop;
    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="h-screen w-full overflow-hidden overscroll-none"
      style={{
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        color: VISUALIZER_CONFIG.colors.text,
      }}
    >
      <HomeStickyHeader
        titleWidth={titleWidth}
        canvasHeight={canvasHeight}
        introWidth={introWidth}
        compactHeaderHeight={compactHeaderHeight}
        expandedHeaderHeight={expandedHeaderHeight}
        compact={compactHeader}
        onExpandedHeightChange={handleExpandedHeightChange}
      />

      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overscroll-none"
        style={{
          paddingTop: headerHeight,
          overscrollBehavior: "none",
          WebkitOverflowScrolling: "auto",
          ["--home-header-height" as string]: `${headerHeight}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
