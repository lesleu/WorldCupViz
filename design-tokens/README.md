# Design tokens

Figma exports live here. Cursor and the app read these files — not Figma directly.

## Folder layout

```
design-tokens/
├── teams.registry.json        ← 48 WC 2026 teams (FIFA code + name)
├── teams.seed.json            ← draft c1–c4 kit colors (46 teams)
├── teams.database.json        ← merged inspectable export (generated)
├── tokens/                    ← Tokens Studio export (do not rename)
│   ├── Foundation/Mode 1.json
│   ├── Team/Mode 1.json       ← merged 48-team palettes (generated)
│   └── Component/Mode 1.json
├── color-rules.json           ← component → color slot mapping
├── assets/                    ← layered SVG exports (sync:assets)
└── reference/                 ← component spec PNGs + compositions/
    ├── compositions/            ← full poster targets (Section E)
    └── …
```

## Team database workflow

1. Edit `teams.registry.json` (names, FIFA codes, confederation)
2. Edit `teams.seed.json` (draft c1–c4 colors) **or** refine palettes in Figma
3. Run:

```bash
npm run sync:teams && npm run sync:tokens
npm run check:teams
```

4. Commit `design-tokens/` and generated files under `src/`

**MEX** and **KOR** palettes always come from Figma (`Team/Mode 1.json` pilot export) — the seed script never overwrites them.

### c1–c4 slots

| Slot | Role |
|------|------|
| c1 | Primary jersey / gradient end |
| c2 | Secondary accent (trim, white) |
| c3 | Highlight / tertiary |
| c4 | Dark gradient start |

## Full token workflow

1. Change tokens in Figma
2. Re-export Tokens Studio JSON into `design-tokens/tokens/`
3. Export updated PNGs into `design-tokens/reference/`
4. Run:

```bash
npm run sync:teams && npm run sync:tokens
```

5. Commit `design-tokens/` and generated files under `src/`

## Generated code (do not edit by hand)

| Script output | Purpose |
|---------------|---------|
| `src/data/teams.generated.ts` | Team names + codes lookup |
| `src/data/teamPalettes.generated.ts` | All 48 teams — c1–c4 by FIFA code |
| `design-tokens/teams.database.json` | Human-readable team + palette export |
| `src/config/foundations.generated.ts` | Paper, ink, event colors |
| `src/config/componentSpecs.generated.ts` | Figma component dimensions |
| `src/design-system/color/colorRules.generated.ts` | Which palette slot each component uses |

## Pilot teams (Figma art direction)

- **MEX** — Mexico (home in demo match)
- **KOR** — Korea Republic (away in demo match)

Refine any team in Figma `Team/Mode 1.json`, add its code to `figmaOverrides` in `teams.seed.json`, then run `npm run sync:teams`.
