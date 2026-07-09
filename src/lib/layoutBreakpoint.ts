export const MOBILE_MAX_WIDTH_PX = 614;

/** Matches Tailwind `max-[614px]` / `min-[615px]` split. */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

export function readIsMobileLayout(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}
