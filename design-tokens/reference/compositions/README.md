# Composition reference posters (Section E)

Export **full poster frames** from Figma here — the finished generative art you want the replay to resemble.

## Active reference

| File | Use |
|------|-----|
| `MEX-KOR-fulltime.png` | Primary target for layout, density, overlap, draw order |

## How Cursor uses this

1. Read the PNG when tuning placement or draw order
2. Follow **`.cursor/rules/composition-reference.mdc`** — rules extracted from the full-time reference
3. Compare replay at **90'** side-by-side with the PNG
4. Tune `composition.config.ts`, `placementEngine.ts`, and draw order in `posterRenderer.ts` — not a separate JSON tuning file

Enable `composition.showZoneDebug: true` in config while aligning zones.

## Suggested exports (optional)

- `MEX-KOR-kickoff.png` — minute 0
- `MEX-KOR-halftime.png` — ~45'
- `MEX-KOR-event-heavy.png` — many goals/cards
