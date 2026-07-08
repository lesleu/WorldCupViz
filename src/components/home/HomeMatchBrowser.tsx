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
  clearHomeRestorePending,
  isHomeRestorePending,
  readHomeScrollState,
  resolveHomeScrollTop,
  scrollRestoredWithinTolerance,
  writeHomeScrollState,
} from "@/lib/homeScrollState";
import { homeTitleMetrics } from "@/lib/stretchedInterText";

const SCROLL_DIRECTION_THRESHOLD = 2;
const SCROLL_PERSIST_MS = 100;
const SCROLL_RESTORE_MAX_FRAMES = 24;
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
  const shouldRestoreRef = useRef(isHomeRestorePending());
  const hasInitializedScroll = useRef(false);
  const pendingRestoreRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const prevCompactRef = useRef(false);
  const compactHeaderRef = useRef(false);
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

  compactHeaderRef.current = compactHeader;

  const handleExpandedHeightChange = useCallback((height: number) => {
    expandedHeightRef.current = height;
    setExpandedHeaderHeight((prev) => (prev === height ? prev : height));
  }, []);

  const applyPendingRestore = useCallback((): boolean => {
    const scroller = scrollRef.current;
    const target = pendingRestoreRef.current;
    if (!scroller || target === null || hasInitializedScroll.current) return false;

    scroller.scrollTop = target;
    lastScrollTopRef.current = scroller.scrollTop;

    if (!scrollRestoredWithinTolerance(scroller, target)) return false;

    pendingRestoreRef.current = null;
    hasInitializedScroll.current = true;
    clearHomeRestorePending();
    return true;
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

    if (pendingRestoreRef.current !== null) {
      applyPendingRestore();
    }
  }, [applyPendingRestore, compactHeader, compactHeaderHeight]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || hasInitializedScroll.current) return;

    if (shouldRestoreRef.current) {
      const saved = readHomeScrollState();
      if (saved) {
        const target = resolveHomeScrollTop(saved);
        pendingRestoreRef.current = target;
        setCompactHeader(saved.compactHeader);
        compactHeaderRef.current = saved.compactHeader;
        applyPendingRestore();
        return;
      }

      clearHomeRestorePending();
      shouldRestoreRef.current = false;
    }

    if (!scrollTargetDateSort) {
      hasInitializedScroll.current = true;
      return;
    }

    const target = document.getElementById(`date-${scrollTargetDateSort}`);
    if (!target) return;

    scroller.scrollTop = Math.max(0, target.offsetTop - expandedHeaderHeight);
    lastScrollTopRef.current = scroller.scrollTop;
    hasInitializedScroll.current = true;
    setCompactHeader(false);
    prevCompactRef.current = false;
  }, [applyPendingRestore, expandedHeaderHeight, scrollTargetDateSort]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || pendingRestoreRef.current === null) return;

    let frame = 0;
    let rafId = 0;

    const retryRestore = () => {
      if (pendingRestoreRef.current === null || hasInitializedScroll.current) return;

      applyPendingRestore();

      frame += 1;
      if (pendingRestoreRef.current === null || frame >= SCROLL_RESTORE_MAX_FRAMES) {
        if (pendingRestoreRef.current !== null) {
          pendingRestoreRef.current = null;
          hasInitializedScroll.current = true;
          clearHomeRestorePending();
        }
        return;
      }

      rafId = requestAnimationFrame(retryRestore);
    };

    rafId = requestAnimationFrame(retryRestore);

    return () => cancelAnimationFrame(rafId);
  }, [applyPendingRestore, compactHeader, expandedHeaderHeight]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    let persistTimer: ReturnType<typeof setTimeout> | undefined;

    const persistScroll = () => {
      if (isHomeRestorePending()) return;

      writeHomeScrollState({
        scrollTop: scroller.scrollTop,
        compactHeader: compactHeaderRef.current,
      });
    };

    const onScroll = () => {
      if (hasInitializedScroll.current) {
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
