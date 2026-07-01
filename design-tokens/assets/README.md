# Layered SVG assets (Figma export)

Export one SVG per visual component into this folder. **Replace the placeholder files** with your Figma exports when ready.

## Filenames

- `PassAccuracy.svg`, `Shot.svg`, `ShotOnTarget.svg`, `Goal.svg`, `Foul.svg`, `Corner.svg`, `Offside.svg`, `YellowCard.svg`, `RedCard.svg`

## Layer naming (must match `color-rules.json`)

**Preferred:** name each Figma group/layer with the color slot id (`c1`, `c2`, `ink.mark`, `event.foul`, …).

**Flat exports also work:** if Figma exports a single flat SVG (no named groups), `npm run sync:assets` assigns shapes automatically — rects vs paths for Goal/Shot, fill color for cards, etc.

Full mapping: [`color-rules.json`](../color-rules.json)

## Sync

```bash
npm run sync:assets
```
