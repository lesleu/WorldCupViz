/**
 * Smoke-test API-Football configuration and team code mapping.
 * Run: npm run check:match-api
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getMatchApiConfig } from "../src/lib/matches/config";
import { fetchLeagueFixtures } from "../src/lib/matches/apiFootballClient";
import { resolveTeamCode } from "../src/lib/matches/teamCodeMap";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

interface RegistryTeam {
  code: string;
  name: string;
}

interface RegistryFile {
  teams: RegistryTeam[];
}

async function main() {
  loadEnvLocal();
  const config = getMatchApiConfig();
  const registryPath = resolve(process.cwd(), "design-tokens/teams.registry.json");
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as RegistryFile;

  console.log("Match API config:");
  console.log(`  enabled: ${config.enabled}`);
  console.log(`  baseUrl: ${config.baseUrl}`);
  console.log(`  leagueId: ${config.leagueId}`);
  console.log(`  season: ${config.season}`);

  if (!config.enabled) {
    console.log("\nMATCH_API_KEY is not set — app will use demo MATCH_CATALOG.");
    console.log("Copy .env.example to .env.local and add your API-Football key.");
    process.exit(0);
  }

  console.log("\nFetching league fixtures…");
  const fixtures = await fetchLeagueFixtures(0);
  console.log(`  fixtures returned: ${fixtures.length}`);

  if (fixtures.length === 0) {
    console.warn(
      "\nNo fixtures found. WC 2026 schedule may not be in API-Football yet — demo catalog fallback will be used."
    );
    process.exit(0);
  }

  const unknownTeams = new Set<string>();
  for (const fixture of fixtures) {
    for (const side of [fixture.teams.home.name, fixture.teams.away.name]) {
      if (!resolveTeamCode(side)) unknownTeams.add(side);
    }
  }

  if (unknownTeams.size > 0) {
    console.error("\nTeams without registry mapping:");
    for (const name of unknownTeams) console.error(`  - ${name}`);
    process.exit(1);
  }

  const mappedCodes = new Set<string>();
  for (const team of registry.teams) {
    mappedCodes.add(team.code);
  }

  console.log(`\nAll fixture teams mapped to registry (${mappedCodes.size} registry codes).`);
  console.log("API setup OK.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
