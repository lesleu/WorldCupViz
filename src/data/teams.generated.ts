// @generated — do not edit. Run: npm run sync:teams

export type Confederation =
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

export const TEAMS_BY_CODE: Record<string, TeamRecord> = {
  "CAN": {
    "code": "CAN",
    "name": "Canada",
    "confederation": "CONCACAF",
    "isHost": true
  },
  "MEX": {
    "code": "MEX",
    "name": "Mexico",
    "confederation": "CONCACAF",
    "isHost": true
  },
  "USA": {
    "code": "USA",
    "name": "United States",
    "confederation": "CONCACAF",
    "isHost": true
  },
  "AUS": {
    "code": "AUS",
    "name": "Australia",
    "confederation": "AFC"
  },
  "IRQ": {
    "code": "IRQ",
    "name": "Iraq",
    "confederation": "AFC"
  },
  "IRN": {
    "code": "IRN",
    "name": "IR Iran",
    "confederation": "AFC"
  },
  "JPN": {
    "code": "JPN",
    "name": "Japan",
    "confederation": "AFC"
  },
  "JOR": {
    "code": "JOR",
    "name": "Jordan",
    "confederation": "AFC"
  },
  "KOR": {
    "code": "KOR",
    "name": "Korea Republic",
    "confederation": "AFC"
  },
  "QAT": {
    "code": "QAT",
    "name": "Qatar",
    "confederation": "AFC"
  },
  "KSA": {
    "code": "KSA",
    "name": "Saudi Arabia",
    "confederation": "AFC"
  },
  "UZB": {
    "code": "UZB",
    "name": "Uzbekistan",
    "confederation": "AFC"
  },
  "ALG": {
    "code": "ALG",
    "name": "Algeria",
    "confederation": "CAF"
  },
  "CPV": {
    "code": "CPV",
    "name": "Cabo Verde",
    "confederation": "CAF"
  },
  "COD": {
    "code": "COD",
    "name": "Congo DR",
    "confederation": "CAF"
  },
  "CIV": {
    "code": "CIV",
    "name": "Côte d'Ivoire",
    "confederation": "CAF"
  },
  "EGY": {
    "code": "EGY",
    "name": "Egypt",
    "confederation": "CAF"
  },
  "GHA": {
    "code": "GHA",
    "name": "Ghana",
    "confederation": "CAF"
  },
  "MAR": {
    "code": "MAR",
    "name": "Morocco",
    "confederation": "CAF"
  },
  "SEN": {
    "code": "SEN",
    "name": "Senegal",
    "confederation": "CAF"
  },
  "RSA": {
    "code": "RSA",
    "name": "South Africa",
    "confederation": "CAF"
  },
  "TUN": {
    "code": "TUN",
    "name": "Tunisia",
    "confederation": "CAF"
  },
  "CUW": {
    "code": "CUW",
    "name": "Curaçao",
    "confederation": "CONCACAF"
  },
  "HAI": {
    "code": "HAI",
    "name": "Haiti",
    "confederation": "CONCACAF"
  },
  "PAN": {
    "code": "PAN",
    "name": "Panama",
    "confederation": "CONCACAF"
  },
  "ARG": {
    "code": "ARG",
    "name": "Argentina",
    "confederation": "CONMEBOL"
  },
  "BRA": {
    "code": "BRA",
    "name": "Brazil",
    "confederation": "CONMEBOL"
  },
  "COL": {
    "code": "COL",
    "name": "Colombia",
    "confederation": "CONMEBOL"
  },
  "ECU": {
    "code": "ECU",
    "name": "Ecuador",
    "confederation": "CONMEBOL"
  },
  "PAR": {
    "code": "PAR",
    "name": "Paraguay",
    "confederation": "CONMEBOL"
  },
  "URU": {
    "code": "URU",
    "name": "Uruguay",
    "confederation": "CONMEBOL"
  },
  "NZL": {
    "code": "NZL",
    "name": "New Zealand",
    "confederation": "OFC"
  },
  "AUT": {
    "code": "AUT",
    "name": "Austria",
    "confederation": "UEFA"
  },
  "BEL": {
    "code": "BEL",
    "name": "Belgium",
    "confederation": "UEFA"
  },
  "BIH": {
    "code": "BIH",
    "name": "Bosnia and Herzegovina",
    "confederation": "UEFA"
  },
  "CRO": {
    "code": "CRO",
    "name": "Croatia",
    "confederation": "UEFA"
  },
  "CZE": {
    "code": "CZE",
    "name": "Czechia",
    "confederation": "UEFA"
  },
  "ENG": {
    "code": "ENG",
    "name": "England",
    "confederation": "UEFA"
  },
  "FRA": {
    "code": "FRA",
    "name": "France",
    "confederation": "UEFA"
  },
  "GER": {
    "code": "GER",
    "name": "Germany",
    "confederation": "UEFA"
  },
  "NED": {
    "code": "NED",
    "name": "Netherlands",
    "confederation": "UEFA"
  },
  "NOR": {
    "code": "NOR",
    "name": "Norway",
    "confederation": "UEFA"
  },
  "POR": {
    "code": "POR",
    "name": "Portugal",
    "confederation": "UEFA"
  },
  "SCO": {
    "code": "SCO",
    "name": "Scotland",
    "confederation": "UEFA"
  },
  "ESP": {
    "code": "ESP",
    "name": "Spain",
    "confederation": "UEFA"
  },
  "SWE": {
    "code": "SWE",
    "name": "Sweden",
    "confederation": "UEFA"
  },
  "SUI": {
    "code": "SUI",
    "name": "Switzerland",
    "confederation": "UEFA"
  },
  "TUR": {
    "code": "TUR",
    "name": "Türkiye",
    "confederation": "UEFA"
  }
};

export const TEAM_CODES = [
  "ALG",
  "ARG",
  "AUS",
  "AUT",
  "BEL",
  "BIH",
  "BRA",
  "CAN",
  "CIV",
  "COD",
  "COL",
  "CPV",
  "CRO",
  "CUW",
  "CZE",
  "ECU",
  "EGY",
  "ENG",
  "ESP",
  "FRA",
  "GER",
  "GHA",
  "HAI",
  "IRN",
  "IRQ",
  "JOR",
  "JPN",
  "KOR",
  "KSA",
  "MAR",
  "MEX",
  "NED",
  "NOR",
  "NZL",
  "PAN",
  "PAR",
  "POR",
  "QAT",
  "RSA",
  "SCO",
  "SEN",
  "SUI",
  "SWE",
  "TUN",
  "TUR",
  "URU",
  "USA",
  "UZB"
] as const;

export type TeamCode = (typeof TEAM_CODES)[number];

export function getTeamByCode(code: string): TeamRecord | undefined {
  return TEAMS_BY_CODE[code.toUpperCase()];
}

export function getTeamName(code: string): string {
  return getTeamByCode(code)?.name ?? code;
}
