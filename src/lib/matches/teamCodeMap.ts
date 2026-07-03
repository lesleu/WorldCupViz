import { TEAMS_BY_CODE } from "@/data/teams.generated";

/** Common provider name variants → FIFA 3-letter code. */
const NAME_ALIASES: Record<string, string> = {
  "south korea": "KOR",
  "korea republic": "KOR",
  "republic of korea": "KOR",
  "iran": "IRN",
  "ir iran": "IRN",
  "united states": "USA",
  "usa": "USA",
  "dr congo": "COD",
  "congo dr": "COD",
  "democratic republic of the congo": "COD",
  "ivory coast": "CIV",
  "cote d'ivoire": "CIV",
  "côte d'ivoire": "CIV",
  "turkey": "TUR",
  "türkiye": "TUR",
  "cape verde": "CPV",
  "cape verde islands": "CPV",
  "cabo verde": "CPV",
  "cabo verde islands": "CPV",
  "bosnia & herzegovina": "BIH",
  "czech republic": "CZE",
  "czechia": "CZE",
  "bosnia and herzegovina": "BIH",
  "bosnia-herzegovina": "BIH",
  "curacao": "CUW",
  "curaçao": "CUW",
  "saudi arabia": "KSA",
  "south africa": "RSA",
  "new zealand": "NZL",
};

const registryNameToCode = new Map<string, string>();

for (const team of Object.values(TEAMS_BY_CODE)) {
  registryNameToCode.set(normalizeName(team.name), team.code);
  registryNameToCode.set(normalizeName(team.code), team.code);
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Resolve a provider team name or code to a FIFA 3-letter registry code.
 * Returns undefined when no registry match is found.
 */
export function resolveTeamCode(
  name: string | null | undefined,
  providerCode?: string | null
): string | undefined {
  if (providerCode) {
    const upper = providerCode.toUpperCase().trim();
    if (TEAMS_BY_CODE[upper]) return upper;
  }

  if (!name) return undefined;

  const normalized = normalizeName(name);
  const alias = NAME_ALIASES[normalized];
  if (alias && TEAMS_BY_CODE[alias]) return alias;

  const fromRegistry = registryNameToCode.get(normalized);
  if (fromRegistry) return fromRegistry;

  return undefined;
}

/**
 * Whether a provider team name represents an undetermined opponent.
 */
export function isTbdTeamName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;

  const normalized = name.trim().toLowerCase();
  if (normalized === "tbd" || normalized === "to be determined") return true;
  if (normalized.startsWith("winner ") || normalized.startsWith("loser ")) {
    return true;
  }
  if (normalized.includes("tbd")) return true;

  return false;
}

export function requireTeamCode(
  name: string,
  providerCode?: string | null
): string {
  const code = resolveTeamCode(name, providerCode);
  if (!code) {
    throw new Error(`Unknown team code for "${name}"`);
  }
  return code;
}
