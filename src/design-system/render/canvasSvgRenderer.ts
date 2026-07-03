import { getComponentColor } from "@/design-system/color/resolveColor";
import { COMPONENT_COLOR_RULES } from "@/design-system/color/colorRules.generated";
import {
  COMPONENT_PATHS,
  type PathCommand,
} from "@/design-system/assets/componentPaths.generated";
import type { VisualComponent } from "@/design-system/mapping/visualMappings";
import type { TeamPalette } from "@/data/teamPalettes.generated";

export interface DrawSvgOptions {
  rotation?: number;
  scalePx?: number;
  widthPx?: number;
  heightPx?: number;
  colorOverrides?: Record<string, string>;
}

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

/** Draw a synced SVG component centered at (x, y) using Canvas 2D. */
export function drawSvgComponent2d(
  ctx: CanvasRenderingContext2D,
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
  let scale: number;
  if (options.scalePx !== undefined) {
    scale = options.scalePx / Math.max(viewBox.w, viewBox.h);
  } else if (options.widthPx !== undefined || options.heightPx !== undefined) {
    const sw = (options.widthPx ?? viewBox.w) / viewBox.w;
    const sh = (options.heightPx ?? viewBox.h) / viewBox.h;
    scale = Math.min(sw, sh);
  } else {
    scale = 1;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-viewBox.x - viewBox.w / 2, -viewBox.y - viewBox.h / 2);

  for (const layerName of layerDrawOrder(component, layers)) {
    const layerDef = layers[layerName];
    if (!layerDef) continue;
    const color =
      options.colorOverrides?.[layerName] ??
      getComponentColor(component, palette, layerName, "c1");
    ctx.fillStyle = color;
    for (let i = 0; i < layerDef.paths.length; i++) {
      const path = layerDef.paths[i];
      const fillRule = layerDef.fillRules?.[i] ?? "nonzero";
      ctx.beginPath();
      tracePathCommands(ctx, path);
      ctx.fill(fillRule);
    }
  }

  ctx.restore();
  return true;
}
