# Component reference PNGs

Export one PNG per Figma spec frame (Section D) into this folder.

Expected filenames (PascalCase, must match exactly):

- `PossessionGrid.png`
- `PassAccuracy.png`
- `Shot.png`
- `ShotOnTarget.png`
- `Goal.png`
- `Foul.png`
- `Corner.png`
- `Offside.png`
- `YellowCard.png`
- `RedCard.png`

**Optional** (not checked by `npm run check:design` until you add them):

- `EventBurst.png`
- `MatchChrome.png`

Cursor reads these when visually QA-ing components. **Geometry source of truth** is the layered SVG in [`../assets/`](../assets/) — sync with `npm run sync:assets`.

Run `npm run check:design` to verify required files are present.

## Foul vs cards vs other marks

Use these reference PNGs to tell components apart:

| Component | Reference | Visual identity | Color layers |
|-----------|-----------|-----------------|--------------|
| **Foul** | `Foul.png` | Three slanted ink slashes only — **no colored square body** | `ink.mark` only |
| **YellowCard** | `YellowCard.png` | Yellow square + four vertical ink bars | `event.cardYellow`, `ink.mark` |
| **RedCard** | `RedCard.png` | Red square + four wavy ink ovals | `event.cardRed`, `ink.mark` |
| **PassAccuracy** | `PassAccuracy.png` | Small black cross/spark (continuous stat, not an event) | `ink.mark` only |
| **Shot / Goal / etc.** | matching PNG | Team-colored geometry — see `color-rules.json` | `c1`–`c4` slots |

Foul marks are **not** cards. Cards always include a yellow or red body layer beneath the ink detail.
