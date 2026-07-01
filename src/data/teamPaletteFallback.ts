import {
  getTeamPalette as getGeneratedPalette,
  TEAM_PALETTES,
  type TeamPalette,
} from "@/data/teamPalettes.generated";

function hashCode(code: string): number {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Deterministic stub palette for teams not yet synced from Figma. */
function stubPaletteForCode(code: string): TeamPalette {
  const hash = hashCode(code.toUpperCase());
  const hue = hash % 360;
  return {
    c1: hslToHex(hue, 0.55, 0.45),
    c2: hslToHex((hue + 40) % 360, 0.5, 0.55),
    c3: hslToHex((hue + 80) % 360, 0.45, 0.6),
    c4: hslToHex((hue + 120) % 360, 0.5, 0.35),
  };
}

export function resolveTeamPalette(code: string): TeamPalette {
  const normalized = code.toUpperCase();
  if (TEAM_PALETTES[normalized]) {
    return getGeneratedPalette(normalized);
  }
  return stubPaletteForCode(normalized);
}
