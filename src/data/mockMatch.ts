import type { TeamPalette } from "@/data/teamPalettes.generated";
import { getTeamName } from "@/data/teams.generated";
import { resolveTeamPalette } from "@/data/teamPaletteFallback";

export type { TeamPalette };
export { TEAM_PALETTES } from "@/data/teamPalettes.generated";
export { resolveTeamPalette, resolveTeamPalette as getTeamPalette } from "@/data/teamPaletteFallback";

export interface TeamStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  passAccuracy: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  goals: number;
  /** Penalty shootout kicks scored (after extra time). */
  penaltyShootoutScored: number;
  /** Penalty shootout kicks missed (after extra time). */
  penaltyShootoutMissed: number;
}

export interface MatchData {
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  stage: string;
  date: string;
  venue?: string;
  home: TeamStats;
  away: TeamStats;
}

export type TeamSide = "home" | "away";

export function paletteForSide(match: MatchData, side: TeamSide): TeamPalette {
  const code = side === "home" ? match.homeTeamCode : match.awayTeamCode;
  return resolveTeamPalette(code);
}

/** Demo match used for replay mode (Mexico vs Korea Republic). */
export const mockMatch: MatchData = {
  homeTeam: getTeamName("MEX"),
  awayTeam: getTeamName("KOR"),
  homeTeamCode: "MEX",
  awayTeamCode: "KOR",
  stage: "GROUP STAGE",
  date: "June 18, 2026",
  venue: "Estadio Guadalajara",
  home: {
    possession: 42,
    shots: 8,
    shotsOnTarget: 4,
    passAccuracy: 77,
    fouls: 5,
    yellowCards: 0,
    redCards: 0,
    goals: 1,
    penaltyShootoutScored: 0,
    penaltyShootoutMissed: 0,
  },
  away: {
    possession: 58,
    shots: 9,
    shotsOnTarget: 2,
    passAccuracy: 83,
    fouls: 3,
    yellowCards: 0,
    redCards: 0,
    goals: 0,
    penaltyShootoutScored: 0,
    penaltyShootoutMissed: 0,
  },
};
