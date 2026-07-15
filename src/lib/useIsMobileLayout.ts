"use client";

import { useLayoutEffect, useState } from "react";
import { MOBILE_MEDIA_QUERY } from "@/lib/layoutBreakpoint";

/**
 * Tracks mobile vs desktop using the same breakpoint as Tailwind
 * `max-[614px]` / `min-[615px]`.
 *
 * Returns `null` until measured so we never mount the wrong p5 canvas
 * (hidden 0×0 hosts + dual engines freeze phones, especially with diagonal pack).
 */
export function useIsMobileLayout(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);

    const sync = () => {
      setIsMobile(media.matches);
    };

    sync();
    media.addEventListener("change", sync);
    window.addEventListener("resize", sync, { passive: true });
    window.visualViewport?.addEventListener("resize", sync);

    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, []);

  return isMobile;
}
