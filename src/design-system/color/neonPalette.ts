import type { TeamPalette } from "@/data/teamPalettes.generated";

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: Rgb): string {
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
      break;
  }
  return [h, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

/**
 * Keep hue; push saturation up and lightness toward a punchier neon band.
 * `amount` 0 = unchanged, 1 = max neonization.
 * Near-whites and deep neutrals are left alone (England kit white, ink blacks).
 */
export function neonizeHex(hex: string, amount = 0.45): string {
  if (!(amount > 0)) return hex;
  const [r, g, b] = hexToRgb(hex);
  let [h, s, l] = rgbToHsl(r, g, b);
  // Kit whites / near-whites and deep near-blacks must stay readable on dark art.
  if (l >= 0.85 || (l <= 0.1 && s < 0.2)) return hex;
  s = Math.min(1, s + (1 - s) * amount);
  // Lift dark muddles, tame washed pastels — toward glowing mid-high.
  const targetL = 0.52;
  l = l + (targetL - l) * amount * 0.55;
  l = Math.min(0.68, Math.max(0.28, l));
  return rgbToHex(hslToRgb(h, s, l));
}

/** Neonize every team palette slot (c1–c5). */
export function neonizePalette(
  palette: TeamPalette,
  amount = 0.45
): TeamPalette {
  if (!(amount > 0)) return palette;
  return {
    c1: neonizeHex(palette.c1, amount),
    c2: neonizeHex(palette.c2, amount),
    c3: neonizeHex(palette.c3, amount),
    c4: neonizeHex(palette.c4, amount),
    c5: neonizeHex(palette.c5, amount),
  };
}
