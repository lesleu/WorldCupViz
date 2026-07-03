const STORAGE_KEY = "wc-vizi-home-scroll";
const RESTORE_PENDING_KEY = "wc-vizi-home-restore-pending";

export const HOME_SCROLLER_SELECTOR = "[data-home-scroller]";

export interface HomeScrollState {
  scrollTop: number;
  compactHeader: boolean;
  anchorDateSort?: string;
  anchorOffset?: number;
}

export function readHomeScrollState(): HomeScrollState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<HomeScrollState>;
    if (typeof parsed.scrollTop !== "number" || !Number.isFinite(parsed.scrollTop)) {
      return null;
    }

    return {
      scrollTop: Math.max(0, parsed.scrollTop),
      compactHeader: parsed.compactHeader === true,
      anchorDateSort:
        typeof parsed.anchorDateSort === "string" ? parsed.anchorDateSort : undefined,
      anchorOffset:
        typeof parsed.anchorOffset === "number" && Number.isFinite(parsed.anchorOffset)
          ? parsed.anchorOffset
          : undefined,
    };
  } catch {
    return null;
  }
}

export function writeHomeScrollState(state: HomeScrollState): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scrollTop: Math.max(0, state.scrollTop),
        compactHeader: state.compactHeader,
        anchorDateSort: state.anchorDateSort,
        anchorOffset: state.anchorOffset,
      })
    );
  } catch {
    // Ignore quota / private browsing errors.
  }
}

export function isHomeRestorePending(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(RESTORE_PENDING_KEY) === "1";
}

export function markHomeRestorePending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RESTORE_PENDING_KEY, "1");
}

export function clearHomeRestorePending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RESTORE_PENDING_KEY);
}

function findScrollAnchor(
  scrollTop: number
): Pick<HomeScrollState, "anchorDateSort" | "anchorOffset"> {
  if (typeof document === "undefined") return {};

  let anchorDateSort: string | undefined;
  let anchorOffset = 0;

  for (const section of document.querySelectorAll<HTMLElement>('[id^="date-"]')) {
    const sectionTop = section.offsetTop;
    if (sectionTop <= scrollTop + 1) {
      anchorDateSort = section.id.replace(/^date-/, "");
      anchorOffset = scrollTop - sectionTop;
    }
  }

  return { anchorDateSort, anchorOffset };
}

export function resolveHomeScrollTop(saved: HomeScrollState): number {
  if (typeof document === "undefined") return saved.scrollTop;

  if (saved.anchorDateSort) {
    const anchor = document.getElementById(`date-${saved.anchorDateSort}`);
    if (anchor) {
      return Math.max(0, anchor.offsetTop + (saved.anchorOffset ?? 0));
    }
  }

  return saved.scrollTop;
}

/** Snapshot homepage scroll — call right before navigating to a match. */
export function prepareHomeReturnNavigation(): void {
  if (typeof document === "undefined") return;

  const scroller = document.querySelector(HOME_SCROLLER_SELECTOR);
  if (!(scroller instanceof HTMLElement)) return;

  const scrollTop = scroller.scrollTop;
  const { anchorDateSort, anchorOffset } = findScrollAnchor(scrollTop);

  writeHomeScrollState({
    scrollTop,
    compactHeader: scroller.dataset.compactHeader === "true",
    anchorDateSort,
    anchorOffset,
  });
  markHomeRestorePending();
}

/** @deprecated Use prepareHomeReturnNavigation */
export function captureHomeScrollState(): void {
  prepareHomeReturnNavigation();
}

export function scrollRestoredWithinTolerance(
  scroller: HTMLElement,
  target: number,
  tolerance = 2
): boolean {
  return Math.abs(scroller.scrollTop - target) <= tolerance;
}
