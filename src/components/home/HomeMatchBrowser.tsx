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
import {
  readHomeScrollState,
  shouldRestoreHomeScroll,
  writeHomeScrollState,
  type HomeScrollInitMode,
} from "@/lib/homeScrollState";
import { useHomeScrollInit } from "@/lib/useHomeScrollInit";
import { homeTitleMetrics } from "@/lib/stretchedInterText";

const SCROLL_DIRECTION_THRESHOLD = 2;
const SCROLL_PERSIST_MS = 100;
const DEFAULT_VIEWPORT_WIDTH = 1920;

interface HomeMatchBrowserProps {
  children: ReactNode;
  scrollMode: HomeScrollInitMode;
  scrollTargetDateSort?: string;
}

export default function HomeMatchBrowser({
  children,
  scrollMode,
  scrollTargetDateSort,
}: HomeMatchBrowserProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const compactHeaderRef = useRef(false);
  const expandedHeightRef = useRef(REF_HEADER_FULL_HEIGHT);

  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_VIEWPORT_WIDTH;
    return window.innerWidth;
  });
  const [compactHeader, setCompactHeader] = useState(() => {
    if (scrollMode === "restore") {
      return readHomeScrollState()?.compactHeader === true;
    }
    return false;
  });
  const [expandedHeaderHeight, setExpandedHeaderHeight] =
    useState(REF_HEADER_FULL_HEIGHT);
  const [headerMeasured, setHeaderMeasured] = useState(() => {
    // Compact header height comes from layout metrics; no DOM measure needed.
    if (scrollMode === "restore" && readHomeScrollState()?.compactHeader === true) {
      return true;
    }
    return false;
  });

  const { titleWidth, canvasHeight, introWidth, compactHeaderHeight } = useMemo(
    () => homeTitleMetrics(viewportWidth),
    [viewportWidth]
  );

  const headerHeight = compactHeader ? compactHeaderHeight : expandedHeaderHeight;

  compactHeaderRef.current = compactHeader;

  const handleExpandedHeightChange = useCallback((height: number) => {
    expandedHeightRef.current = height;
    setExpandedHeaderHeight((prev) => (prev === height ? prev : height));
    setHeaderMeasured(true);
  }, []);

  const handleScrollTopApplied = useCallback((scrollTop: number) => {
    lastScrollTopRef.current = scrollTop;
  }, []);

  const { initialized: scrollInitialized } = useHomeScrollInit({
    scrollerRef: scrollRef,
    mode: scrollMode,
    scrollTargetDateSort,
    expandedHeaderHeight,
    enabled: headerMeasured,
    onScrollTopApplied: handleScrollTopApplied,
  });

  const prevCompactRef = useRef(compactHeader);

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

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    let persistTimer: ReturnType<typeof setTimeout> | undefined;

    const persistScroll = () => {
      if (shouldRestoreHomeScroll() || !scrollInitialized.current) return;

      const scrollTop = scroller.scrollTop;
      let anchorDateSort: string | undefined;
      let anchorOffset = 0;

      for (const section of scroller.querySelectorAll<HTMLElement>('[id^="date-"]')) {
        const sectionTop =
          section.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop;
        if (sectionTop <= scrollTop + 1) {
          anchorDateSort = section.id.replace(/^date-/, "");
          anchorOffset = scrollTop - sectionTop;
        }
      }

      writeHomeScrollState({
        scrollTop,
        compactHeader: compactHeaderRef.current,
        anchorDateSort,
        anchorOffset,
      });
    };

    const onScroll = () => {
      if (scrollInitialized.current) {
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
      }

      lastScrollTopRef.current = scroller.scrollTop;

      clearTimeout(persistTimer);
      persistTimer = setTimeout(persistScroll, SCROLL_PERSIST_MS);
    };

    lastScrollTopRef.current = scroller.scrollTop;
    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      clearTimeout(persistTimer);
    };
  }, [scrollInitialized]);

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
        data-home-scroller
        data-compact-header={compactHeader ? "true" : "false"}
        className="h-full overflow-x-hidden overflow-y-auto overscroll-none"
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
