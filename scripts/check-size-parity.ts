/**
 * Warns if hand-tuned config files reintroduce px size fields
 * that should come from componentSizes.generated.ts.
 * Run: npm run check:sizes
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_DIR = path.join(ROOT, "src", "config");

/** Legacy size field names — sizes belong in Figma tokens + designScale.ts. */
const BANNED_SIZE_FIELDS = [
  "squareSizeMin",
  "squareSizeMax",
  "patternPixelSize",
  "starOuterMin",
  "starOuterMax",
  "monumentHeight",
  "monumentWidth",
  "rectWidthMin",
  "rectWidthMax",
  "rectHeightMin",
  "rectHeightMax",
  "yellowWidth",
  "yellowHeight",
  "redWidth",
  "redHeight",
  "pinwheelSize",
  "segmentWidth",
  "segmentHeight",
  "segmentGap",
  "segmentCornerRadius",
  "sparkSize",
  "circleSize",
  "circleGap",
  "gridMaxWidthRatio",
  "gridMaxHeightRatio",
];

const SKIP_FILES = new Set([
  "componentSpecs.generated.ts",
  "componentSizes.generated.ts",
  "foundations.generated.ts",
  "types.ts",
  "design.config.ts",
]);

let violations = 0;

for (const file of fs.readdirSync(CONFIG_DIR)) {
  if (!file.endsWith(".config.ts") && !file.endsWith(".ts")) continue;
  if (SKIP_FILES.has(file)) continue;

  const content = fs.readFileSync(path.join(CONFIG_DIR, file), "utf8");
  for (const field of BANNED_SIZE_FIELDS) {
    const pattern = new RegExp(`\\b${field}\\s*:`);
    if (pattern.test(content)) {
      console.warn(`Size field "${field}" in src/config/${file} — use componentSizes.generated.ts instead`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.warn(`\n${violations} legacy size field(s) found in config.`);
  process.exitCode = 1;
} else {
  console.log("No legacy px size fields in hand-tuned config.");
}
