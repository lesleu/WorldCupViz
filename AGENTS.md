# World Cup Vizi

Generative poster visualizer for World Cup match data (p5.js canvas + Next.js UI).

## Design system

- **Figma tokens:** [`design-tokens/`](design-tokens/) — export JSON + layered SVG + reference PNGs
- **Sync tokens:** `npm run sync:tokens` — updates generated TS from Figma JSON
- **Sync SVG assets:** `npm run sync:assets` — parses layered SVG → `componentPaths.generated.ts`
- **Visual language:** [`VISUAL_LANGUAGE.md`](VISUAL_LANGUAGE.md)
- **Mappings:** [`src/design-system/mapping/visualMappings.ts`](src/design-system/mapping/visualMappings.ts)

## SVG asset pipeline

Export one SVG per component to [`design-tokens/assets/`](design-tokens/assets/). Name Figma groups to match color roles in [`color-rules.json`](design-tokens/color-rules.json) (e.g. Goal: `body`, `accent`; Shot: `background`, `pattern`).

```
Figma layered SVG → design-tokens/assets/*.svg
                  → npm run sync:assets
                  → componentPaths.generated.ts
                  → drawSvgComponent() in posterRenderer.ts
```

**PossessionGrid** stays procedural (100 circles). All other marks draw via SVG.

## Sizing pipeline

Figma component tokens are **px at 1920×1080** ([`design.config.ts`](src/config/design.config.ts)).

```
runtimePx = figmaPx × min(artworkWidth/1920, artworkHeight/1080)
```

- **Generated sizes:** [`componentSizes.generated.ts`](src/config/componentSizes.generated.ts) — flat min/max px per component
- **Scale helpers:** [`designScale.ts`](src/design-system/layout/designScale.ts) — `resolveComponentSize()`, `denormSize()`
- **Behavior only:** [`src/config/*.config.ts`](src/config/) — opacities, jitter, segment counts, animation (no px sizes)

Mark dimensions are stored **normalized to artwork width** and denormalized on draw (resize-safe).

## Zone layout

Each team zone splits into:

- **`gridRegion`** — possession grid only (corner; home top-left, away top-right). Size comes from Figma `PossessionGrid.gridSize` (604px at 1920×1080) via `resolvePossessionGridMetrics()`.
- **`markRegion`** — event marks spread via [`placementEngine.ts`](src/design-system/layout/placementEngine.ts) with light overlap

Set `composition.showZoneDebug: true` in config to outline regions during dev.

## Composition reference (final poster targets)

Full poster example: [`design-tokens/reference/compositions/MEX-KOR-fulltime.png`](design-tokens/reference/compositions/MEX-KOR-fulltime.png)

Cursor rules extracted from that image: [`.cursor/rules/composition-reference.mdc`](.cursor/rules/composition-reference.mdc) — draw order, overlap, zone layout, orthogonal rotation, static render.

Tune `composition.config.ts` and placement code to match; compare replay at 90' side-by-side with the PNG.

## Key rules for AI edits

1. Never hardcode hex in `posterRenderer.ts` — use `getComponentColor()` + team palettes
2. Never hand-tune component px in config — use `resolveComponentSize()` + Figma tokens
3. Draw marks via `drawSvgComponent()` — do not hand-code polygons or stars
4. Before changing draw code, read `design-tokens/assets/{ComponentName}.svg` and optional `design-tokens/reference/{ComponentName}.png`
5. Left/right = placement only; same shapes both sides
6. Team colors: `getTeamPalette("MEX")` → `{ c1, c2, c3, c4 }`

## Commands

```bash
npm run dev
npm run sync:tokens
npm run sync:assets
npm run check:design
npm run check:sizes
npm run build
```
