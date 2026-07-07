/**
 * Parses layered SVG exports from Figma into componentPaths.generated.ts
 * Run: npm run sync:assets
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ASSETS_DIR = path.join(ROOT, "design-tokens", "assets");
const GENERATED_HEADER = "// @generated — do not edit. Run: npm run sync:assets\n\n";

const SVG_COMPONENTS = [
  "PassAccuracy",
  "Shot",
  "ShotOnTarget",
  "Goal",
  "Foul",
  "Corner",
  "Offside",
  "YellowCard",
  "RedCard",
] as const;

type PathCommand =
  | { t: "M"; x: number; y: number }
  | { t: "L"; x: number; y: number }
  | { t: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { t: "Z" };

function readJson(relativePath: string): Record<string, Record<string, string>> {
  const raw = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), "utf8")
  ) as Record<string, Record<string, string>>;
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => !key.startsWith("_"))
  );
}

function parseViewBox(svg: string): { x: number; y: number; w: number; h: number } {
  const vb = svg.match(/viewBox=["']([^"']+)["']/i);
  if (vb) {
    const parts = vb[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
  }
  const w = Number(svg.match(/width=["']([\d.]+)/i)?.[1] ?? 100);
  const h = Number(svg.match(/height=["']([\d.]+)/i)?.[1] ?? 100);
  return { x: 0, y: 0, w, h };
}

function parsePathD(d: string): PathCommand[] {
  const cmds: PathCommand[] = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return cmds;

  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const num = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case "M":
        cx = num();
        cy = num();
        sx = cx;
        sy = cy;
        cmds.push({ t: "M", x: cx, y: cy });
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cx = num();
          cy = num();
          cmds.push({ t: "L", x: cx, y: cy });
        }
        break;
      case "m":
        cx += num();
        cy += num();
        sx = cx;
        sy = cy;
        cmds.push({ t: "M", x: cx, y: cy });
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cx += num();
          cy += num();
          cmds.push({ t: "L", x: cx, y: cy });
        }
        break;
      case "L":
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cx = num();
          cy = num();
          cmds.push({ t: "L", x: cx, y: cy });
        }
        break;
      case "l":
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cx += num();
          cy += num();
          cmds.push({ t: "L", x: cx, y: cy });
        }
        break;
      case "H":
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cx = num();
          cmds.push({ t: "L", x: cx, y: cy });
        }
        break;
      case "h":
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cx += num();
          cmds.push({ t: "L", x: cx, y: cy });
        }
        break;
      case "V":
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cy = num();
          cmds.push({ t: "L", x: cx, y: cy });
        }
        break;
      case "v":
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          cy += num();
          cmds.push({ t: "L", x: cx, y: cy });
        }
        break;
      case "C":
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const x1 = num();
          const y1 = num();
          const x2 = num();
          const y2 = num();
          cx = num();
          cy = num();
          cmds.push({ t: "C", x1, y1, x2, y2, x: cx, y: cy });
        }
        break;
      case "c":
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const x1 = cx + num();
          const y1 = cy + num();
          const x2 = cx + num();
          const y2 = cy + num();
          cx += num();
          cy += num();
          cmds.push({ t: "C", x1, y1, x2, y2, x: cx, y: cy });
        }
        break;
      case "Z":
      case "z":
        cmds.push({ t: "Z" });
        cx = sx;
        cy = sy;
        break;
      default:
        break;
    }
  }
  return cmds;
}

function rectToPath(x: number, y: number, w: number, h: number): PathCommand[] {
  return [
    { t: "M", x, y },
    { t: "L", x: x + w, y },
    { t: "L", x: x + w, y: y + h },
    { t: "L", x, y: y + h },
    { t: "Z" },
  ];
}

function stripDefs(svg: string): string {
  return svg.replace(/<defs[\s\S]*?<\/defs>/gi, "");
}

function parseFill(tag: string): string | undefined {
  const fill = tag.match(/\bfill=["']([^"']+)["']/i)?.[1];
  if (!fill || fill === "none") return undefined;
  return fill.toLowerCase();
}

function normalizeHex(fill: string): string {
  return fill.replace(/\s/g, "").toLowerCase();
}

function isInkFill(fill: string | undefined): boolean {
  if (!fill) return false;
  const f = normalizeHex(fill);
  return f === "black" || f === "#000" || f === "#000000" || f.startsWith("#171") || f.startsWith("#282");
}

function isCardYellowFill(fill: string | undefined): boolean {
  if (!fill) return false;
  const f = normalizeHex(fill);
  return f.includes("fec7") || f.includes("ffd") || f.includes("yellow");
}

function isCardRedFill(fill: string | undefined): boolean {
  if (!fill) return false;
  const f = normalizeHex(fill);
  return f.includes("f520") || f.includes("ff000") || f === "#f00" || f === "#ff0000";
}

function isFoulFill(fill: string | undefined): boolean {
  if (!fill) return false;
  const f = normalizeHex(fill);
  return f.includes("fe4802") || f.includes("ff4802") || f.includes("orange");
}

type ShapeKind = "path" | "rect" | "ellipse";

type FillRule = "evenodd" | "nonzero";

interface FlatShape {
  kind: ShapeKind;
  fill?: string;
  fillRule: FillRule;
  paths: PathCommand[][];
}

function parseFillRule(tag: string): FillRule {
  const rule = tag.match(/\bfill-rule=["']([^"']+)["']/i)?.[1]?.toLowerCase();
  return rule === "evenodd" ? "evenodd" : "nonzero";
}

function parseShapesFromFragment(fragment: string): FlatShape[] {
  const shapes: FlatShape[] = [];

  const pathRe = /<path\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(fragment))) {
    const d = m[1].match(/\bd=["']([^"']+)["']/i)?.[1];
    if (!d) continue;
    shapes.push({
      kind: "path",
      fill: parseFill(m[1]),
      fillRule: parseFillRule(m[1]),
      paths: [parsePathD(d)],
    });
  }

  const rectRe = /<rect\b([^>]*)\/?>/gi;
  while ((m = rectRe.exec(fragment))) {
    const attrs = m[1];
    const x = Number(attrs.match(/\bx=["']([^"']+)["']/i)?.[1] ?? 0);
    const y = Number(attrs.match(/\by=["']([^"']+)["']/i)?.[1] ?? 0);
    const w = Number(attrs.match(/\bwidth=["']([^"']+)["']/i)?.[1] ?? 0);
    const h = Number(attrs.match(/\bheight=["']([^"']+)["']/i)?.[1] ?? 0);
    if (w <= 0 || h <= 0) continue;
    shapes.push({
      kind: "rect",
      fill: parseFill(attrs),
      fillRule: parseFillRule(attrs),
      paths: [rectToPath(x, y, w, h)],
    });
  }

  const ellipseRe = /<ellipse\b([^>]*)\/?>/gi;
  while ((m = ellipseRe.exec(fragment))) {
    const attrs = m[1];
    const cx = Number(attrs.match(/\bcx=["']([^"']+)["']/i)?.[1] ?? 0);
    const cy = Number(attrs.match(/\bcy=["']([^"']+)["']/i)?.[1] ?? 0);
    const rx = Number(attrs.match(/\brx=["']([^"']+)["']/i)?.[1] ?? 0);
    const ry = Number(attrs.match(/\bry=["']([^"']+)["']/i)?.[1] ?? 0);
    if (rx <= 0 || ry <= 0) continue;
    shapes.push({
      kind: "ellipse",
      fill: parseFill(attrs),
      fillRule: parseFillRule(attrs),
      paths: [[
        { t: "M", x: cx - rx, y: cy },
        { t: "C", x1: cx - rx, y1: cy - ry * 0.552, x2: cx - rx * 0.552, y2: cy - ry, x: cx, y: cy - ry },
        { t: "C", x1: cx + rx * 0.552, y1: cy - ry, x2: cx + rx, y2: cy - ry * 0.552, x: cx + rx, y: cy },
        { t: "C", x1: cx + rx, y1: cy + ry * 0.552, x2: cx + rx * 0.552, y2: cy + ry, x: cx, y: cy + ry },
        { t: "C", x1: cx - rx * 0.552, y1: cy + ry, x2: cx - rx, y2: cy + ry * 0.552, x: cx - rx, y: cy },
        { t: "Z" },
      ]],
    });
  }

  return shapes;
}

function extractFlatShapes(svg: string): FlatShape[] {
  return parseShapesFromFragment(stripDefs(svg));
}

interface LayerBuild {
  paths: PathCommand[][];
  fillRules: FillRule[];
  fills: (string | undefined)[];
}

function pushToLayer(
  layers: Record<string, LayerBuild>,
  layerName: string,
  paths: PathCommand[][],
  fillRule: FillRule = "nonzero",
  fill?: string
) {
  if (!layers[layerName]) {
    layers[layerName] = { paths: [], fillRules: [], fills: [] };
  }
  for (const path of paths) {
    layers[layerName].paths.push(path);
    layers[layerName].fillRules.push(fillRule);
    layers[layerName].fills.push(fill);
  }
}

/** Split a compound SVG path (multiple M…Z subpaths) into separate contours. */
function splitPathSubpaths(commands: PathCommand[]): PathCommand[][] {
  const segments: PathCommand[][] = [];
  let current: PathCommand[] = [];
  for (const cmd of commands) {
    if (cmd.t === "M" && current.length > 0) {
      segments.push(current);
      current = [cmd];
    } else {
      current.push(cmd);
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

/** Map flat Figma exports (no named groups) into color-rule layer ids. */
function assignFlatLayers(
  component: string,
  shapes: FlatShape[],
  ruleKeys: string[]
): Record<string, LayerBuild> {
  const layers: Record<string, LayerBuild> = {};
  const has = (key: string) => ruleKeys.includes(key);

  const singleLayer = ruleKeys.length === 1 ? ruleKeys[0] : undefined;

  for (const shape of shapes) {
    const fill = shape.fill;

    if (component === "PassAccuracy" && has("ink.mark")) {
      pushToLayer(layers, "ink.mark", shape.paths, shape.fillRule, shape.fill);
      continue;
    }

    if (component === "YellowCard") {
      if (isInkFill(fill) && has("ink.mark")) {
        pushToLayer(layers, "ink.mark", shape.paths, shape.fillRule, shape.fill);
      } else if (has("event.cardYellow")) {
        pushToLayer(layers, "event.cardYellow", shape.paths, shape.fillRule, shape.fill);
      }
      continue;
    }

    if (component === "RedCard") {
      if (isInkFill(fill) && has("ink.mark")) {
        pushToLayer(layers, "ink.mark", shape.paths, shape.fillRule, shape.fill);
      } else if (has("event.cardRed")) {
        pushToLayer(layers, "event.cardRed", shape.paths, shape.fillRule, shape.fill);
      }
      continue;
    }

    if (component === "Foul") {
      if (isInkFill(fill) && has("ink.mark")) {
        pushToLayer(layers, "ink.mark", shape.paths, shape.fillRule, shape.fill);
      } else if (has("ink.mark")) {
        pushToLayer(layers, "ink.mark", shape.paths, shape.fillRule, shape.fill);
      } else if (isFoulFill(fill) && has("event.foul")) {
        pushToLayer(layers, "event.foul", shape.paths, shape.fillRule, shape.fill);
      }
      continue;
    }

    if (component === "Offside") {
      if (has("c2")) {
        pushToLayer(layers, "c2", shape.paths, shape.fillRule, shape.fill);
      } else if (has("c1")) {
        pushToLayer(layers, "c1", shape.paths, shape.fillRule, shape.fill);
      }
      continue;
    }

    if (component === "Corner") {
      if (has("c5")) {
        pushToLayer(layers, "c5", shape.paths, shape.fillRule, shape.fill);
      } else if (has("c1")) {
        pushToLayer(layers, "c1", shape.paths, shape.fillRule, shape.fill);
      }
      continue;
    }

    if (component === "ShotOnTarget") {
      if (has("c2")) {
        pushToLayer(layers, "c2", shape.paths, shape.fillRule, shape.fill);
      } else if (has("c1")) {
        pushToLayer(layers, "c1", shape.paths, shape.fillRule, shape.fill);
      }
      continue;
    }

    if (component === "Goal") {
      if (shape.kind === "rect" && has("c1")) {
        pushToLayer(layers, "c1", shape.paths, shape.fillRule, shape.fill);
      } else if (has("c4")) {
        pushToLayer(layers, "c4", shape.paths, shape.fillRule, shape.fill);
      }
      continue;
    }

    if (component === "Shot") {
      if (shape.kind === "rect" && has("c1")) {
        pushToLayer(layers, "c1", shape.paths, shape.fillRule, shape.fill);
      } else if (has("c2")) {
        pushToLayer(layers, "c2", shape.paths, shape.fillRule, shape.fill);
      }
      continue;
    }

    if (singleLayer) {
      pushToLayer(layers, singleLayer, shape.paths, shape.fillRule, shape.fill);
      continue;
    }

    if (isInkFill(fill) && has("ink.mark")) {
      pushToLayer(layers, "ink.mark", shape.paths, shape.fillRule, shape.fill);
    } else if (ruleKeys[0]) {
      pushToLayer(layers, ruleKeys[0], shape.paths, shape.fillRule, shape.fill);
    }
  }

  return layers;
}

function serializeLayerBuild(built: LayerBuild): {
  paths: PathCommand[][];
  fillRules?: FillRule[];
  fills?: string[];
} {
  const fills: string[] = [];
  let hasLiteralFills = false;
  for (const fill of built.fills) {
    if (fill) {
      fills.push(fill);
      hasLiteralFills = true;
    } else {
      fills.push("");
    }
  }
  return {
    paths: built.paths,
    fillRules: built.fillRules,
    ...(hasLiteralFills ? { fills } : {}),
  };
}

function layersFromSvg(
  svg: string,
  component: string,
  rules: Record<string, string>
): { layers: Record<string, { paths: PathCommand[][]; fillRules?: FillRule[]; fills?: string[] }>; mode: "groups" | "flat" } {
  const layers: Record<string, { paths: PathCommand[][]; fillRules?: FillRule[]; fills?: string[] }> = {};
  const ruleKeys = Object.keys(rules);

  for (const layerName of ruleKeys) {
    const layerPaths = extractLayerPaths(svg, layerName);
    if (layerPaths.paths.length > 0) layers[layerName] = layerPaths;
  }

  if (Object.keys(layers).length > 0) {
    return { layers, mode: "groups" };
  }

  const flat = assignFlatLayers(component, extractFlatShapes(svg), ruleKeys);
  for (const layerName of ruleKeys) {
    const built = flat[layerName];
    if (built?.paths.length) {
      layers[layerName] = serializeLayerBuild(built);
    }
  }
  for (const [layerName, built] of Object.entries(flat)) {
    if (!layers[layerName] && built.paths.length > 0) {
      layers[layerName] = serializeLayerBuild(built);
    }
  }
  return { layers, mode: "flat" };
}

function extractLayerPaths(
  svg: string,
  layerId: string
): { paths: PathCommand[][]; fillRules: FillRule[]; fills?: string[] } {
  const paths: PathCommand[][] = [];
  const fillRules: FillRule[] = [];
  const fills: string[] = [];
  const groupRe = new RegExp(
    `<g[^>]*\\bid=["']${layerId}["'][^>]*>([\\s\\S]*?)<\\/g>`,
    "i"
  );
  const groupMatch = svg.match(groupRe);
  if (!groupMatch) return { paths, fillRules };

  const inner = groupMatch[1];

  const pathRe = /<path\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(inner))) {
    const attrs = m[1];
    const d = attrs.match(/\bd=["']([^"']+)["']/i)?.[1];
    if (!d) continue;
    paths.push(parsePathD(d));
    fillRules.push(parseFillRule(attrs));
    fills.push(parseFill(attrs) ?? "");
  }

  const rectRe = /<rect\b([^>]*)\/?>/gi;
  while ((m = rectRe.exec(inner))) {
    const attrs = m[1];
    const x = Number(attrs.match(/\bx=["']([^"']+)["']/i)?.[1] ?? 0);
    const y = Number(attrs.match(/\by=["']([^"']+)["']/i)?.[1] ?? 0);
    const w = Number(attrs.match(/\bwidth=["']([^"']+)["']/i)?.[1] ?? 0);
    const h = Number(attrs.match(/\bheight=["']([^"']+)["']/i)?.[1] ?? 0);
    if (w <= 0 || h <= 0) continue;
    paths.push(rectToPath(x, y, w, h));
    fillRules.push(parseFillRule(attrs));
    fills.push(parseFill(attrs) ?? "");
  }

  const ellipseRe = /<ellipse\b([^>]*)\/?>/gi;
  while ((m = ellipseRe.exec(inner))) {
    const attrs = m[1];
    const cx = Number(attrs.match(/\bcx=["']([^"']+)["']/i)?.[1] ?? 0);
    const cy = Number(attrs.match(/\bcy=["']([^"']+)["']/i)?.[1] ?? 0);
    const rx = Number(attrs.match(/\brx=["']([^"']+)["']/i)?.[1] ?? 0);
    const ry = Number(attrs.match(/\bry=["']([^"']+)["']/i)?.[1] ?? 0);
    if (rx <= 0 || ry <= 0) continue;
    paths.push([
      { t: "M", x: cx - rx, y: cy },
      { t: "C", x1: cx - rx, y1: cy - ry * 0.552, x2: cx - rx * 0.552, y2: cy - ry, x: cx, y: cy - ry },
      { t: "C", x1: cx + rx * 0.552, y1: cy - ry, x2: cx + rx, y2: cy - ry * 0.552, x: cx + rx, y: cy },
      { t: "C", x1: cx + rx, y1: cy + ry * 0.552, x2: cx + rx * 0.552, y2: cy + ry, x: cx, y: cy + ry },
      { t: "C", x1: cx - rx * 0.552, y1: cy + ry, x2: cx - rx, y2: cy + ry * 0.552, x: cx - rx, y: cy },
      { t: "Z" },
    ]);
    fillRules.push(parseFillRule(attrs));
    fills.push(parseFill(attrs) ?? "");
  }

  if (paths.length === 0) return { paths, fillRules };
  return {
    paths,
    fillRules,
    ...(fills.some((fill) => fill.length > 0) ? { fills } : {}),
  };
}

function main() {
  console.log("Syncing SVG assets…");
  const colorRules = readJson("design-tokens/color-rules.json");
  const output: Record<string, unknown> = {};

  for (const component of SVG_COMPONENTS) {
    const filePath = path.join(ASSETS_DIR, `${component}.svg`);
    if (!fs.existsSync(filePath)) {
      console.warn(`  missing: design-tokens/assets/${component}.svg`);
      continue;
    }
    const svg = fs.readFileSync(filePath, "utf8");
    const viewBox = parseViewBox(svg);
    const rules = colorRules[component] ?? {};
    const { layers, mode } = layersFromSvg(svg, component, rules);

    if (Object.keys(layers).length === 0) {
      console.warn(
        `  no layers parsed for ${component} — add Figma groups named ${Object.keys(rules).join(", ") || "(see color-rules.json)"}`
      );
    } else if (mode === "flat") {
      console.log(`  parsed ${component} (flat Figma export): ${Object.keys(layers).join(", ")}`);
    } else {
      console.log(`  parsed ${component}: ${Object.keys(layers).join(", ")}`);
    }

    output[component] = { viewBox, layers };
  }

  const outPath = path.join(ROOT, "src/design-system/assets/componentPaths.generated.ts");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `${GENERATED_HEADER}import type { VisualComponent } from "@/design-system/mapping/visualMappings";

export type PathCommand =
  | { t: "M"; x: number; y: number }
  | { t: "L"; x: number; y: number }
  | { t: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { t: "Z" };

export interface SvgLayerDef {
  paths: PathCommand[][];
  fillRules?: ("evenodd" | "nonzero")[];
  /** Literal hex fills from the SVG export — one per path, used 1:1 at render time. */
  fills?: string[];
}

export interface SvgComponentDef {
  viewBox: { x: number; y: number; w: number; h: number };
  layers: Record<string, SvgLayerDef>;
}

export const COMPONENT_PATHS: Partial<Record<VisualComponent, SvgComponentDef>> = ${JSON.stringify(output, null, 2)};
`,
    "utf8"
  );
  console.log("  wrote src/design-system/assets/componentPaths.generated.ts");
}

main();
