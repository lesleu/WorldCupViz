"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import {
  clearHomeNavigationFlags,
  readHomeScrollState,
  resolveHomeScrollTop,
  scrollOffsetInScroller,
  scrollRestoredWithinTolerance,
  type HomeScrollInitMode,
  type HomeScrollState,
} from "@/lib/homeScrollState";

const RESTORE_RETRY_MS = 50;
const RESTORE_MAX_ATTEMPTS = 40;
const RESTORE_STABLE_MS = 50;
const RESTORE_CORRECT_MS = 600;

interface UseHomeScrollInitOptions {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  mode: HomeScrollInitMode;
  scrollTargetDateSort?: string;
  expandedHeaderHeight: number;
  enabled: boolean;
  onScrollTopApplied: (scrollTop: number) => void;
}

export function useHomeScrollInit({
  scrollerRef,
  mode,
  scrollTargetDateSort,
  expandedHeaderHeight,
  enabled,
  onScrollTopApplied,
}: UseHomeScrollInitOptions): { initialized: React.RefObject<boolean> } {
  const initialized = useRef(false);

  const applyScroll = useCallback(
    (force = false): boolean => {
      const scroller = scrollerRef.current;
      if (!scroller || (!force && initialized.current)) return false;

      const hasSections = scroller.querySelector('[id^="date-"]');
      if (!hasSections) return false;

      if (mode === "restore") {
        const saved = readHomeScrollState();
        if (!saved) return false;

        const target = resolveHomeScrollTop(saved, scroller);
        scroller.scrollTop = target;
        onScrollTopApplied(target);
        return scrollRestoredWithinTolerance(scroller, target, 12);
      }

      if (!scrollTargetDateSort) return true;

      const target = scroller.querySelector<HTMLElement>(
        `#date-${CSS.escape(scrollTargetDateSort)}`
      );
      if (!target) return false;

      const top = Math.max(0, scrollOffsetInScroller(target, scroller));
      scroller.scrollTop = top;
      onScrollTopApplied(top);
      return scrollRestoredWithinTolerance(scroller, top, 12);
    },
    [mode, onScrollTopApplied, scrollTargetDateSort, scrollerRef]
  );

  useLayoutEffect(() => {
    if (!enabled || initialized.current) return;

    const scroller = scrollerRef.current;
    if (!scroller) return;

    let attempts = 0;
    let observer: ResizeObserver | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let stableTimer: ReturnType<typeof setTimeout> | null = null;
    let correctObserver: ResizeObserver | null = null;
    let correctTimer: ReturnType<typeof setTimeout> | null = null;

    const applySavedRestore = (saved: HomeScrollState): number => {
      const target = resolveHomeScrollTop(saved, scroller);
      scroller.scrollTop = target;
      onScrollTopApplied(target);
      return target;
    };

    const finish = () => {
      if (initialized.current) return;

      if (!applyScroll(true)) {
        if (mode === "restore") {
          const saved = readHomeScrollState();
          if (saved) applySavedRestore(saved);
        } else if (scrollTargetDateSort) {
          const target = scroller.querySelector<HTMLElement>(
            `#date-${CSS.escape(scrollTargetDateSort)}`
          );
          if (target) {
            const top = Math.max(0, scrollOffsetInScroller(target, scroller));
            scroller.scrollTop = top;
            onScrollTopApplied(top);
          }
        }
      }

      initialized.current = true;
      clearHomeNavigationFlags();
      retryTimer && clearInterval(retryTimer);
      observer?.disconnect();

      if (mode === "restore") {
        const saved = readHomeScrollState();
        if (saved) {
          const reapply = () => {
            applySavedRestore(saved);
          };

          correctObserver = new ResizeObserver(reapply);
          correctObserver.observe(scroller);
          for (const section of scroller.querySelectorAll<HTMLElement>('[id^="date-"]')) {
            correctObserver.observe(section);
          }

          correctTimer = setTimeout(() => {
            reapply();
            correctObserver?.disconnect();
          }, RESTORE_CORRECT_MS);
        }
      }
    };

    const scheduleRestoreFinish = () => {
      if (stableTimer) clearTimeout(stableTimer);
      stableTimer = setTimeout(finish, RESTORE_STABLE_MS);
    };

    const tryApply = () => {
      if (initialized.current) return;

      if (mode === "restore") {
        if (applyScroll()) {
          scheduleRestoreFinish();
          return;
        }
        if (attempts >= RESTORE_MAX_ATTEMPTS) {
          finish();
        }
        return;
      }

      if (applyScroll() || attempts >= RESTORE_MAX_ATTEMPTS) {
        finish();
      }
    };

    if (mode === "restore" ? applyScroll() : applyScroll()) {
      if (mode === "restore") scheduleRestoreFinish();
      else finish();
    } else {
      observer = new ResizeObserver(() => tryApply());
      observer.observe(scroller);
      for (const section of scroller.querySelectorAll<HTMLElement>('[id^="date-"]')) {
        observer.observe(section);
      }

      retryTimer = setInterval(() => {
        attempts += 1;
        tryApply();
      }, RESTORE_RETRY_MS);
    }

    return () => {
      stableTimer && clearTimeout(stableTimer);
      retryTimer && clearInterval(retryTimer);
      correctTimer && clearTimeout(correctTimer);
      observer?.disconnect();
      correctObserver?.disconnect();
    };
  }, [
    applyScroll,
    enabled,
    expandedHeaderHeight,
    mode,
    onScrollTopApplied,
    scrollTargetDateSort,
    scrollerRef,
  ]);

  return { initialized };
}
