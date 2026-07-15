import type p5 from "p5";
import { resolveSvgPathFill } from "@/design-system/color/resolveColor";
import { COMPONENT_COLOR_RULES } from "@/design-system/color/colorRules.generated";
import {
  COMPONENT_PATHS,
  type PathCommand,
  type SvgComponentDef,
} from "@/design-system/assets/componentPaths.generated";
import type { VisualComponent } from "@/design-system/mapping/visualMappings";
import type { TeamPalette } from "@/data/teamPalettes.generated";

/** Back → front draw order from color-rules.json (not SVG parse order). */
function layerDrawOrder(component: VisualComponent, layers: Record<string, unknown>): string[] {
  const ruleOrder = Object.keys(COMPONENT_COLOR_RULES[component] ?? {});
  const present = new Set(Object.keys(layers));
  const ordered = ruleOrder.filter((name) => present.has(name));
  for (const name of Object.keys(layers)) {
    if (!ordered.includes(name)) ordered.push(name);
  }
  return ordered;
}

function tracePathCommands(ctx: CanvasRenderingContext2D, commands: PathCommand[]) {
  for (const cmd of commands) {
    switch (cmd.t) {
      case "M":
        ctx.moveTo(cmd.x, cmd.y);
        break;
      case "L":
        ctx.lineTo(cmd.x, cmd.y);
        break;
      case "C":
        ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        break;
      case "Z":
        ctx.closePath();
        break;
    }
  }
}

export function getSvgComponentDef(component: VisualComponent): SvgComponentDef | undefined {
  return COMPONENT_PATHS[component];
}

let svgAssetWarningShown = false;

/** Log once in dev when synced SVG layers are missing (usually need `npm run sync:assets`). */
export function warnIfSvgAssetsMissing(): void {
  if (svgAssetWarningShown || process.env.NODE_ENV === "production") return;
  const missing: string[] = [];
  for (const [name, def] of Object.entries(COMPONENT_PATHS)) {
    if (!def || Object.keys(def.layers).length === 0) missing.push(name);
  }
  if (missing.length > 0) {
    svgAssetWarningShown = true;
    console.warn(
      `[World Cup Vizi] SVG layers missing for: ${missing.join(", ")}. Run: npm run sync:assets`
    );
  }
}

export interface DrawSvgOptions {
  rotation?: number;
  scalePx?: number;
  /** Exact pixel box — uniform scale to fit width × height (preserves SVG aspect). */
  widthPx?: number;
  heightPx?: number;
  /**
   * When true with widthPx/heightPx, scale X and Y independently so the SVG
   * fills the box (stretches). Used for Goal/Foul/Offside on the mosaic grid.
   */
  stretchToBox?: boolean;
  /** Override layer colors (layer name → hex). */
  colorOverrides?: Record<string, string>;
}

/**
 * Draw a synced SVG component centered at (x, y) with team palette colors per layer.
 */
export function drawSvgComponent(
  p: p5,
  component: VisualComponent,
  palette: TeamPalette,
  x: number,
  y: number,
  options: DrawSvgOptions = {}
): boolean {
  const def = COMPONENT_PATHS[component];
  if (!def || Object.keys(def.layers).length === 0) return false;

  const { viewBox, layers } = def;
  const rot = options.rotation ?? 0;
  const useBox =
    options.widthPx !== undefined && options.heightPx !== undefined;

  p.push();
  p.translate(x, y);
  if (rot !== 0) p.rotate(rot);

  if (useBox) {
    const sx = options.widthPx! / viewBox.w;
    const sy = options.heightPx! / viewBox.h;
    if (options.stretchToBox) {
      p.scale(sx, sy);
    } else {
      const scale = Math.min(sx, sy);
      p.scale(scale, scale);
    }
  } else {
    const scale =
      options.scalePx !== undefined
        ? options.scalePx / Math.max(viewBox.w, viewBox.h)
        : 1;
    p.scale(scale);
  }

  p.translate(-viewBox.x - viewBox.w / 2, -viewBox.y - viewBox.h / 2);

  const ctx = p.drawingContext as CanvasRenderingContext2D;
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewBox.x, viewBox.y, viewBox.w, viewBox.h);
  ctx.clip();

  for (const layerName of layerDrawOrder(component, layers)) {
    const layerDef = layers[layerName];
    if (!layerDef) continue;
    for (let i = 0; i < layerDef.paths.length; i++) {
      const path = layerDef.paths[i];
      const fillRule = layerDef.fillRules?.[i] ?? "nonzero";
      ctx.fillStyle = resolveSvgPathFill(
        component,
        palette,
        layerName,
        i,
        layerDef,
        options.colorOverrides
      );
      ctx.beginPath();
      tracePathCommands(ctx, path);
      ctx.fill(fillRule);
    }
  }

  ctx.restore();
  p.pop();
  return true;
}
