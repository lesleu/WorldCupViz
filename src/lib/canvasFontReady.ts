import { cfg } from "@/config";

function readCssFontVar(name: string): string {
  if (typeof document === "undefined") return "";

  return (
    getComputedStyle(document.body).getPropertyValue(name).trim() ||
    getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  );
}

/** Resolve the loaded Next.js Inter family for canvas (CSS vars are invalid in ctx.font). */
export function resolveKickoffCanvasFontFamily(): string {
  if (typeof document === "undefined") {
    return cfg.typography.kickoffCodeFontFamily;
  }

  return readCssFontVar("--font-inter-extrabold") || cfg.typography.kickoffCodeFontFamily;
}

export function resolveInterSemiBoldFontFamily(): string {
  if (typeof document === "undefined") {
    return "Inter, sans-serif";
  }

  return readCssFontVar("--font-inter-semibold") || "Inter, sans-serif";
}

export function canvasFontSpec(
  weight: number,
  sizePx: number,
  family: string
): string {
  const normalizedFamily = family.trim() || cfg.typography.kickoffCodeFontFamily;
  return `${weight} ${sizePx}px ${normalizedFamily}`;
}

export function applyCanvasFont(
  ctx: CanvasRenderingContext2D,
  weight: number,
  sizePx: number,
  family: string
): void {
  ctx.font = canvasFontSpec(weight, sizePx, family);
}

export function kickoffCanvasFontSpec(sizePx = 64): string {
  const { kickoffCodeFontWeight } = cfg.typography;
  return canvasFontSpec(
    kickoffCodeFontWeight,
    sizePx,
    resolveKickoffCanvasFontFamily()
  );
}

/** Best-effort font warmup — always resolves so canvas can redraw. */
export async function waitForKickoffCanvasFont(sizePx = 64): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;

  const spec = kickoffCanvasFontSpec(sizePx);
  try {
    await Promise.race([
      document.fonts.load(spec),
      document.fonts.ready,
      new Promise<void>((resolve) => window.setTimeout(resolve, 250)),
    ]);
  } catch {
    // Redraw with fallback family.
  }
}

/** Warm up Inter weights used by match poster chrome (title + meta). */
export async function waitForMatchChromeFonts(
  titleSizePx = cfg.typography.teamNameSize * 0.5,
  metaSizePx = cfg.typography.metaSize + 1,
  vsSizePx = cfg.typography.vsSize
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;

  const boldFamily = resolveKickoffCanvasFontFamily();
  const metaFamily = resolveInterSemiBoldFontFamily();
  const boldSpecs = [
    canvasFontSpec(800, titleSizePx, boldFamily),
    canvasFontSpec(800, vsSizePx, boldFamily),
  ];
  const metaSpec = canvasFontSpec(600, metaSizePx, metaFamily);

  try {
    await Promise.race([
      Promise.all([...boldSpecs.map((spec) => document.fonts.load(spec)), document.fonts.load(metaSpec)]),
      document.fonts.ready,
      new Promise<void>((resolve) => window.setTimeout(resolve, 400)),
    ]);
  } catch {
    // Redraw with fallback family.
  }
}
