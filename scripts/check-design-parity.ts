/**
 * Verifies layered SVG assets and optional reference PNGs exist for each component.
 * Run: npm run check:design
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const REF_DIR = path.join(ROOT, "design-tokens", "reference");
const ASSET_DIR = path.join(ROOT, "design-tokens", "assets");

/** Required layered SVG exports (geometry source of truth). */
const REQUIRED_SVG_COMPONENTS = [
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

/** Required reference PNGs for human visual QA (optional for build). */
const REQUIRED_REFERENCE_PNGS = [
  "PossessionGrid",
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

/** Optional — add when you want Cursor to match Figma for these. */
const OPTIONAL_COMPONENTS = ["EventBurst", "MatchChrome"] as const;

let svgMissing = 0;
for (const name of REQUIRED_SVG_COMPONENTS) {
  const filePath = path.join(ASSET_DIR, `${name}.svg`);
  if (!fs.existsSync(filePath)) {
    console.warn(`Missing SVG: design-tokens/assets/${name}.svg`);
    svgMissing++;
  }
}

let pngMissing = 0;
for (const name of REQUIRED_REFERENCE_PNGS) {
  const filePath = path.join(REF_DIR, `${name}.png`);
  if (!fs.existsSync(filePath)) {
    console.warn(`Missing reference PNG: design-tokens/reference/${name}.png`);
    pngMissing++;
  }
}

for (const name of OPTIONAL_COMPONENTS) {
  const filePath = path.join(REF_DIR, `${name}.png`);
  if (!fs.existsSync(filePath)) {
    console.log(`Optional (skipped): design-tokens/reference/${name}.png`);
  }
}

if (svgMissing > 0) {
  console.warn(
    `\n${svgMissing} required SVG asset(s) missing. Export from Figma and run npm run sync:assets.`
  );
  process.exitCode = 1;
} else {
  console.log(
    `All ${REQUIRED_SVG_COMPONENTS.length} required layered SVG assets present.`
  );
}

if (pngMissing > 0) {
  console.warn(
    `${pngMissing} reference PNG(s) missing (optional for build; useful for visual QA).`
  );
} else {
  console.log(`All ${REQUIRED_REFERENCE_PNGS.length} reference PNGs present.`);
}
