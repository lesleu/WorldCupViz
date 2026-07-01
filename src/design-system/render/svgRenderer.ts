import type p5 from "p5";
import { getComponentColor } from "@/design-system/color/resolveColor";
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

function drawPathCommands(p: p5, commands: PathCommand[]) {
  p.beginShape();
  for (const cmd of commands) {
    switch (cmd.t) {
      case "M":
        p.vertex(cmd.x, cmd.y);
        break;
      case "L":
        p.vertex(cmd.x, cmd.y);
        break;
      case "C":
        p.bezierVertex(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        break;
      case "Z":
        p.endShape(p.CLOSE);
        p.beginShape();
        break;
    }
  }
  p.endShape(p.CLOSE);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length !== 6) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
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
  /** Scale uniformly to fit width and height (uses max dimension). */
  widthPx?: number;
  heightPx?: number;
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

  p.push();
  p.translate(x, y);
  p.rotate(rot);
  p.scale(scale);
  p.translate(-viewBox.x - viewBox.w / 2, -viewBox.y - viewBox.h / 2);

  for (const layerName of layerDrawOrder(component, layers)) {
    const layerDef = layers[layerName];
    if (!layerDef) continue;
    const color =
      options.colorOverrides?.[layerName] ??
      getComponentColor(component, palette, layerName, "c1");
    const rgb = hexToRgb(color);
    p.fill(rgb[0], rgb[1], rgb[2]);
    p.noStroke();
    for (const path of layerDef.paths) {
      drawPathCommands(p, path);
    }
  }

  p.pop();
  return true;
}
