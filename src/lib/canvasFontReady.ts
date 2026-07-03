import { cfg } from "@/config";

/** Resolve the loaded Next.js Inter family for canvas (CSS vars are invalid in ctx.font). */
export function resolveKickoffCanvasFontFamily(): string {
  if (typeof document === "undefined") {
    return cfg.typography.kickoffCodeFontFamily;
  }

  const fromVar = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-inter-extrabold")
    .trim();

  return fromVar || cfg.typography.kickoffCodeFontFamily;
}

export function kickoffCanvasFontSpec(sizePx = 64): string {
  const { kickoffCodeFontWeight } = cfg.typography;
  return `${kickoffCodeFontWeight} ${sizePx}px ${resolveKickoffCanvasFontFamily()}`;
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
