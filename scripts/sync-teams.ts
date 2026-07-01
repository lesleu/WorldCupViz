/**
 * Merges teams.registry.json + teams.seed.json + Figma pilot overrides
 * into design-tokens/tokens/Team/Mode 1.json and teams.database.json.
 * Run: npm run sync:teams
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const GENERATED_HEADER = "// @generated — do not edit. Run: npm run sync:teams\n\n";
const TEAM_TOKENS_PATH = "design-tokens/tokens/Team/Mode 1.json";
const EXPECTED_TEAM_COUNT = 48;

type Json = Record<string, unknown>;

interface TeamRegistryEntry {
  code: string;
  name: string;
  confederation: string;
  isHost?: boolean;
}

interface TeamRegistry {
  tournament: string;
  teamCount: number;
  teams: TeamRegistryEntry[];
}

interface SeedPalette {
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  source?: string;
}

interface TeamsSeed {
  figmaOverrides: string[];
  palettes: Record<string, SeedPalette>;
}

interface TeamPalette {
  c1: string;
  c2: string;
  c3: string;
  c4: string;
}

function readJson<T>(relativePath: string): T {
  const filePath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeFile(relativePath: string, content: string) {
  const filePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  wrote ${relativePath}`);
}

function tokenValue(node: unknown): string | null {
  if (node && typeof node === "object" && "$value" in node) {
    const value = (node as { $value: unknown }).$value;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function extractPalettes(teamJson: Json): Record<string, TeamPalette> {
  const palettes: Record<string, TeamPalette> = {};
  for (const [code, slots] of Object.entries(teamJson)) {
    if (!slots || typeof slots !== "object") continue;
    const s = slots as Json;
    const c1 = tokenValue(s.c1);
    const c2 = tokenValue(s.c2);
    const c3 = tokenValue(s.c3);
    const c4 = tokenValue(s.c4);
    if (c1 && c2 && c3 && c4) palettes[code] = { c1, c2, c3, c4 };
  }
  return palettes;
}

function colorToken(hex: string): Json {
  return {
    $extensions: {
      "com.figma.scopes": ["ALL_SCOPES"],
      "com.figma.hiddenFromPublishing": false,
    },
    $type: "color",
    $value: hex,
  };
}

function paletteToTokenEntry(palette: TeamPalette): Json {
  return {
    c1: colorToken(palette.c1),
    c2: colorToken(palette.c2),
    c3: colorToken(palette.c3),
    c4: colorToken(palette.c4),
  };
}

function validateRegistry(registry: TeamRegistry): TeamRegistryEntry[] {
  const codes = registry.teams.map((t) => t.code);
  const unique = new Set(codes);
  if (unique.size !== codes.length) {
    throw new Error("Duplicate team codes in teams.registry.json");
  }
  if (registry.teams.length !== EXPECTED_TEAM_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_TEAM_COUNT} teams in registry, got ${registry.teams.length}`
    );
  }
  return registry.teams;
}

function main() {
  console.log("Syncing team database…");

  const registry = readJson<TeamRegistry>("design-tokens/teams.registry.json");
  const seed = readJson<TeamsSeed>("design-tokens/teams.seed.json");
  const existingTeamJson = readJson<Json>(TEAM_TOKENS_PATH);
  const figmaPalettes = extractPalettes(existingTeamJson);

  const teams = validateRegistry(registry);
  const merged: Record<string, TeamPalette> = {};

  for (const team of teams) {
    const code = team.code;
    const figma = figmaPalettes[code];

    if (figma) {
      merged[code] = figma;
      continue;
    }

    const seeded = seed.palettes[code];
    if (!seeded) {
      throw new Error(
        `Missing palette for ${code}. Add it in ${TEAM_TOKENS_PATH} or teams.seed.json.`
      );
    }
    merged[code] = {
      c1: seeded.c1,
      c2: seeded.c2,
      c3: seeded.c3,
      c4: seeded.c4,
    };
  }

  if (Object.keys(merged).length !== EXPECTED_TEAM_COUNT) {
    throw new Error(`Merged palette count mismatch: ${Object.keys(merged).length}`);
  }

  const teamTokens: Json = {};
  for (const code of Object.keys(merged).sort()) {
    teamTokens[code] = paletteToTokenEntry(merged[code]);
  }

  writeFile(TEAM_TOKENS_PATH, `${JSON.stringify(teamTokens, null, 2)}\n`);

  const database = {
    tournament: registry.tournament,
    teamCount: teams.length,
    generatedAt: new Date().toISOString(),
    teams: teams.map((team) => ({
      ...team,
      palette: merged[team.code],
      paletteSource: figmaPalettes[team.code]
        ? "figma"
        : seed.palettes[team.code]?.source ?? "seed",
    })),
  };

  writeFile(
    "design-tokens/teams.database.json",
    `${JSON.stringify(database, null, 2)}\n`
  );

  const teamsByCode = Object.fromEntries(teams.map((t) => [t.code, t]));

  writeFile(
    "src/data/teams.generated.ts",
    `${GENERATED_HEADER}export type Confederation =
  | "AFC"
  | "CAF"
  | "CONCACAF"
  | "CONMEBOL"
  | "OFC"
  | "UEFA";

export interface TeamRecord {
  code: string;
  name: string;
  confederation: Confederation;
  isHost?: boolean;
}

export const TEAMS_BY_CODE: Record<string, TeamRecord> = ${JSON.stringify(teamsByCode, null, 2)};

export const TEAM_CODES = ${JSON.stringify(teams.map((t) => t.code).sort(), null, 2)} as const;

export type TeamCode = (typeof TEAM_CODES)[number];

export function getTeamByCode(code: string): TeamRecord | undefined {
  return TEAMS_BY_CODE[code.toUpperCase()];
}

export function getTeamName(code: string): string {
  return getTeamByCode(code)?.name ?? code;
}
`
  );

  console.log(
    `Done. ${teams.length} teams synced (${Object.keys(figmaPalettes).length} from Figma tokens).`
  );
}

main();
