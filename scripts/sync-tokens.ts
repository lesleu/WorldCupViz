/**
 * Reads Figma Tokens Studio exports and generates TypeScript modules.
 * Run: npm run sync:tokens
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOKENS_DIR = path.join(ROOT, "design-tokens", "tokens");
const GENERATED_HEADER = "// @generated — do not edit. Run: npm run sync:tokens\n\n";

type Json = Record<string, unknown>;

function readJson(relativePath: string): Json {
  const filePath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Json;
}

function tokenValue(node: unknown): string | number | null {
  if (node && typeof node === "object" && "$value" in node) {
    const value = (node as { $value: unknown }).$value;
    if (typeof value === "string" || typeof value === "number") return value;
  }
  return null;
}

function tokenColor(node: unknown): string | null {
  const value = tokenValue(node);
  return typeof value === "string" ? value : null;
}

function tokenNumber(node: unknown): number | null {
  const value = tokenValue(node);
  return typeof value === "number" ? value : typeof value === "string" ? Number(value) : null;
}

function extractTeamPalettes(
  teamJson: Json
): Record<string, { c1: string; c2: string; c3: string; c4: string; c5: string }> {
  const palettes: Record<
    string,
    { c1: string; c2: string; c3: string; c4: string; c5: string }
  > = {};
  for (const [code, slots] of Object.entries(teamJson)) {
    if (!slots || typeof slots !== "object") continue;
    const s = slots as Json;
    const c1 = tokenColor(s.c1);
    const c2 = tokenColor(s.c2);
    const c3 = tokenColor(s.c3);
    const c4 = tokenColor(s.c4);
    const c5 = tokenColor(s.c5) ?? tokenColor(s["c4 2"]);
    if (c1 && c2 && c3 && c4 && c5) palettes[code] = { c1, c2, c3, c4, c5 };
    else if (c1 && c2 && c3 && c4) palettes[code] = { c1, c2, c3, c4, c5: c3 };
  }
  return palettes;
}

function writeFile(relativePath: string, content: string) {
  const filePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  wrote ${relativePath}`);
}

/** Map Figma token group keys → VISUAL_COMPONENT PascalCase names. */
const FIGMA_COMPONENT_MAP: Record<string, string> = {
  Possession: "PossessionGrid",
  PassAccuracy: "PassAccuracy",
  shots: "Shot",
  shotsontarget: "ShotOnTarget",
  goal: "Goal",
  foul: "Foul",
  corner: "Corner",
  offsize: "Offside",
  yellowcard: "YellowCard",
  redcard: "RedCard",
};

function camelKey(tokenKey: string): string {
  return tokenKey.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function extractComponentSizes(componentJson: Json): Record<string, Record<string, number>> {
  const sizes: Record<string, Record<string, number>> = {};

  for (const [figmaKey, fields] of Object.entries(componentJson)) {
    const codeName = FIGMA_COMPONENT_MAP[figmaKey] ?? figmaKey;
    if (!fields || typeof fields !== "object") continue;

    const entry: Record<string, number> = {};
    for (const [fieldKey, node] of Object.entries(fields as Json)) {
      const num = tokenNumber(node);
      if (num !== null) entry[camelKey(fieldKey)] = num;
    }
    if (Object.keys(entry).length > 0) sizes[codeName] = entry;
  }

  return sizes;
}

function main() {
  console.log("Syncing design tokens…");

  const foundation = readJson("design-tokens/tokens/Foundation/Mode 1.json");
  const team = readJson("design-tokens/tokens/Team/Mode 1.json");
  const component = readJson("design-tokens/tokens/Component/Mode 1.json");
  const colorRulesRaw = readJson("design-tokens/color-rules.json");
  const paletteTinted = Array.isArray(colorRulesRaw._paletteTinted)
    ? (colorRulesRaw._paletteTinted as string[])
    : ["Shot", "Goal"];
  const colorRules = Object.fromEntries(
    Object.entries(colorRulesRaw).filter(([key]) => !key.startsWith("_"))
  );

  const paper = foundation.paper as Json;
  const ink = foundation.ink as Json;
  const events = foundation.events as Json;
  const world1 = foundation.world1 as Json;
  const world2 = foundation.world2 as Json;

  const foundations = {
    paper: {
      background: tokenColor(paper?.background) ?? "#eeece8",
      cream: tokenColor(paper?.cream) ?? "#f7f5f1",
    },
    ink: {
      text: tokenColor(ink?.text) ?? "#151515",
      textMuted: tokenColor(ink?.["text-muted"]) ?? "#201f1f",
      mark: tokenColor(ink?.mark) ?? "#282828",
    },
    event: {
      foul: tokenColor(events?.foul) ?? "#fe4802",
      cardYellow: tokenColor(events?.["card-yellow"]) ?? "#fec702",
      cardRed: tokenColor(events?.["card-red"]) ?? "#f52020",
      offside: tokenColor(events?.offside) ?? "#384cf4",
    },
    world1: {
      c1: tokenColor(world1?.c1) ?? "#fe4802",
      c2: tokenColor(world1?.c2) ?? "#2ccf8b",
    },
    world2: {
      c1: tokenColor(world2?.c1) ?? "#883f3f",
      c2: tokenColor(world2?.c2) ?? "#ab99e2",
      c3: tokenColor(world2?.c3) ?? "#ab98e2",
    },
  };

  const palettes = extractTeamPalettes(team);

  writeFile(
    "src/config/foundations.generated.ts",
    `${GENERATED_HEADER}export const foundationsGenerated = ${JSON.stringify(foundations, null, 2)} as const;
`
  );

  writeFile(
    "src/data/teamPalettes.generated.ts",
    `${GENERATED_HEADER}export interface TeamPalette {
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  c5: string;
}

export const TEAM_PALETTES: Record<string, TeamPalette> = ${JSON.stringify(palettes, null, 2)};

export function getTeamPalette(code: string): TeamPalette {
  const palette = TEAM_PALETTES[code];
  if (!palette) {
    throw new Error(\`Unknown team code: \${code}. Add it in Figma Team tokens and run npm run sync:tokens.\`);
  }
  return palette;
}
`
  );

  const componentSizes = extractComponentSizes(component);

  writeFile(
    "src/config/componentSpecs.generated.ts",
    `${GENERATED_HEADER}/** Raw Figma component dimensions — design reference for Cursor and draw functions. */
export const componentSpecsGenerated = ${JSON.stringify(component, null, 2)} as const;
`
  );

  writeFile(
    "src/config/componentSizes.generated.ts",
    `${GENERATED_HEADER}import type { VisualComponent } from "@/design-system/mapping/visualMappings";

/** Flat Figma px values at 1920×1080 artboard — scaled at runtime via designScale.ts. */
export const COMPONENT_SIZES: Partial<
  Record<
    VisualComponent,
    {
      circleSize?: number;
      gridSize?: number;
      sizeMin?: number;
      sizeMax?: number;
      sizeXMin?: number;
      sizeXMax?: number;
      sizeYMin?: number;
      sizeYMax?: number;
      starpoint?: number;
    }
  >
> = ${JSON.stringify(componentSizes, null, 2)};
`
  );

  writeFile(
    "src/design-system/color/colorRules.generated.ts",
    `${GENERATED_HEADER}import type { VisualComponent } from "@/design-system/mapping/visualMappings";

export type ColorSlot =
  | "c1"
  | "c2"
  | "c3"
  | "c4"
  | "c5"
  | "paper.cream"
  | "ink.text"
  | "ink.textMuted"
  | "ink.mark"
  | "event.foul"
  | "event.offside"
  | "event.cardYellow"
  | "event.cardRed"
  | "world1.c1"
  | "world1.c2"
  | "world2.c1"
  | "world2.c2"
  | "world2.c3";

export type ComponentColorRules = Partial<Record<VisualComponent, Record<string, ColorSlot>>>;

export const COMPONENT_COLOR_RULES: ComponentColorRules = ${JSON.stringify(colorRules, null, 2)};

/** Components whose SVG fills are swapped for team palette slots at render time. */
export const PALETTE_TINTED_COMPONENTS = ${JSON.stringify(paletteTinted)} as const;
`
  );

  console.log(`Done. Teams: ${Object.keys(palettes).join(", ")}`);
}

main();
