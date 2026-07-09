"use client";

import { useLayoutEffect, useState } from "react";
import { MOBILE_MEDIA_QUERY, readIsMobileLayout } from "@/lib/layoutBreakpoint";

/**
 * Tracks mobile vs desktop using the same breakpoint as Tailwind
 * `max-[614px]` / `min-[615px]`.
 */
export function useIsMobileLayout(): boolean {
  const [isMobile, setIsMobile] = useState(readIsMobileLayout);

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
