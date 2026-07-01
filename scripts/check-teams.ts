/**
 * Validates WC 2026 team registry, seed palettes, and merged Team tokens.
 * Run: npm run check:teams
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const EXPECTED_TEAM_COUNT = 48;
const FIGMA_PILOT_CODES = ["MEX", "KOR"] as const;

type Json = Record<string, unknown>;

interface TeamRegistry {
  teamCount: number;
  teams: { code: string; name: string }[];
}

interface TeamsSeed {
  figmaOverrides: string[];
  palettes: Record<string, { c1: string; c2: string; c3: string; c4: string }>;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), "utf8")
  ) as T;
}

function tokenValue(node: unknown): string | null {
  if (node && typeof node === "object" && "$value" in node) {
    const value = (node as { $value: unknown }).$value;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function extractPalettes(teamJson: Json): Record<string, { c1: string; c2: string; c3: string; c4: string }> {
  const palettes: Record<string, { c1: string; c2: string; c3: string; c4: string }> = {};
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

let errors = 0;

function fail(message: string) {
  console.error(`ERROR: ${message}`);
  errors++;
}

const registry = readJson<TeamRegistry>("design-tokens/teams.registry.json");
const seed = readJson<TeamsSeed>("design-tokens/teams.seed.json");
const teamJson = readJson<Json>("design-tokens/tokens/Team/Mode 1.json");
const merged = extractPalettes(teamJson);

const codes = registry.teams.map((t) => t.code);
const uniqueCodes = new Set(codes);

if (registry.teams.length !== EXPECTED_TEAM_COUNT) {
  fail(`Registry has ${registry.teams.length} teams, expected ${EXPECTED_TEAM_COUNT}`);
}

if (uniqueCodes.size !== codes.length) {
  fail("Duplicate codes in teams.registry.json");
}

for (const team of registry.teams) {
  if (!merged[team.code]) {
    fail(`Missing merged palette for ${team.code} in Team/Mode 1.json`);
  }
}

for (const code of Object.keys(merged)) {
  if (!uniqueCodes.has(code)) {
    fail(`Extra palette in Team/Mode 1.json not in registry: ${code}`);
  }
}

for (const code of registry.teams.map((t) => t.code)) {
  if (FIGMA_PILOT_CODES.includes(code as (typeof FIGMA_PILOT_CODES)[number])) continue;
  if (!seed.palettes[code]) {
    fail(`Missing seed palette for ${code}`);
  }
}

for (const code of FIGMA_PILOT_CODES) {
  if (!merged[code]) {
    fail(`Missing Figma pilot palette for ${code}`);
  }
}

if (Object.keys(merged).length !== EXPECTED_TEAM_COUNT) {
  fail(`Team/Mode 1.json has ${Object.keys(merged).length} palettes, expected ${EXPECTED_TEAM_COUNT}`);
}

if (!fs.existsSync(path.join(ROOT, "src/data/teams.generated.ts"))) {
  fail("Missing src/data/teams.generated.ts — run npm run sync:teams");
}

if (!fs.existsSync(path.join(ROOT, "design-tokens/teams.database.json"))) {
  fail("Missing design-tokens/teams.database.json — run npm run sync:teams");
}

if (errors > 0) {
  console.error(`\n${errors} team check(s) failed.`);
  process.exit(1);
}

console.log(`All ${EXPECTED_TEAM_COUNT} teams validated (registry, seed, merged tokens).`);
