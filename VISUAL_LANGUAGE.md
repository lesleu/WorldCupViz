# World Cup Vizi — Visual Language

This document describes how football match data becomes generative poster art. Use it to art-direct components, tune `VISUALIZER_CONFIG`, and understand what each stat or event should *feel* like on canvas.

For machine-readable mappings, see **`src/design-system/mapping/visualMappings.ts`**.

---

## Design philosophy

We visualize **match energy**, not a statistics dashboard.

- **Statistics are inputs.** Possession, shots, and goals are data.
- **Emotion is the output.** Tension, dominance, disruption, and memory are what the viewer should feel.

The artwork is **two separate accumulated artifacts** — one per team — separated by neutral center space. By 90 minutes, each side should look like its own dense match history.

---

## Composition rules

The canvas is divided into **three zones**:

| Zone | Content |
|------|---------|
| **Left** | Home team — all home marks stay here |
| **Center** | Neutral negative space — nothing is drawn here |
| **Right** | Away team — all away marks stay here |

**Hard rules:**
- Home graphics stay on the left. Away graphics stay on the right.
- The two team systems **never collide, overlap, or merge**.
- **No central collision circle.** The center is empty paper, not an active object.
- Events accumulate **within each team zone only**.
- The visual story comes from **contrast, balance, density, and growth** between the two sides.

Each side can respond to the other through motion, scale, rhythm, and density — but not through physical overlap.

---

## Two kinds of data

### Continuous state (`continuous_state`)

Values that **morph every frame** and are **never cleared** during a replay.

| Data | Component | What the viewer feels |
|------|-----------|------------------------|
| **Possession** | `PossessionGrid` | Territory control — filled circle grid grows/shifts |
| **Pass accuracy** | `PassAccuracy` | Technical quality — clean vs broken symbol |

### Discrete events (`event`)

Actions that **append permanent marks** to one team's side once, at the minute they occur.

Each event also triggers **`EventBurst`** — a short ripple on that team's side (goals also shake the canvas).

---

## Visual components

### `PossessionGrid` ← possession

**Drawn as:** 10 row × 10 column grid of circles on each team side. 100 circles = 100%. Filled count = possession %.

**Example:** 57% possession → 57 filled circles, 43 unfilled.

**Behavior:** Morphs continuously as possession changes. Subtle ripple/breathing on each circle.

**Tune in config:** `possession` (gridRows, gridCols, circleSize, circleGap, filledOpacity, unfilledOpacity), `composition.zones`, `animation`

---

### `PassAccuracy` ← passAccuracy

**Drawn as:** Scattered asterisk sparks within each team zone.

- **≥ 60% accuracy:** Clean, symmetrical sparks
- **< 60% accuracy:** More broken, asymmetrical sparks with angular jitter

**Also affects:** Fragmentation of event mark angles when they spawn.

**Tune in config:** `passAccuracy` (cleanThreshold, cleanSparkCount, brokenSparkCount, sparkSize)

---

### `Shot` ← shot

**Drawn as:** Cluster of pixel/block rectangles near team anchor.

**Behavior:** Permanent. More shots = more burst clusters on that side. Slight vibration.

**Tune in config:** `shots`, `composition.zones`

---

### `ShotOnTarget` ← shot_on_target

**Drawn as:** Sharp multi-point starburst — more intense than Shot.

**Behavior:** Placed toward inner edge of team zone (center-facing) but never crosses into gap.

**Tune in config:** `shotsOnTarget`, `composition.zones`

---

### `Goal` ← goal

**Drawn as:** Tall jagged spike/mark on scoring team's side.

**Behavior:** Largest permanent mark on that side. Strong EventBurst + canvas shake on arrival.

**Tune in config:** `goals`, `energy`

---

### `Foul` ← foul

**Drawn as:** Orange rectangle with black horizontal oval fractures.

**Behavior:** Disruption scar within that team's ecosystem.

**Tune in config:** `fouls`, `colors.foulFill`

---

### `Corner` ← corner

**Drawn as:** Pinwheel / hourglass — four triangular arms from center.

**Behavior:** Set-piece pressure mark. Slight rotation oscillation.

**Tune in config:** `corners`

---

### `Offside` ← offside

**Drawn as:** Three stacked rounded horizontal segments.

**Behavior:** Broken timing / failed attack. Subtle drift.

**Tune in config:** `offsides`

---

### `YellowCard` / `RedCard` ← yellow_card / red_card

**Drawn as:** Yellow or red rectangle with black horizontal ovals inside.

**Behavior:** Yellow = small warning. Red = larger, stronger rupture.

**Tune in config:** `cards`

---

### `EventBurst` (secondary, all events)

**Drawn as:** Expanding ring at team anchor when energy spikes.

**Behavior:** Decays quickly. Never drawn in center gap.

**Tune in config:** `energy`, `animation`

---

### `MatchChrome` ← match metadata

**Drawn as:** Header (team names, score, meta) + footer progress line.

**Behavior:** Static framing around the generative artwork.

**Tune in config:** `typography`, `layout`

---

## Zone layout

Tune in `composition.zones`:

- `centerGapWidthRatio` — width of neutral center
- `homeZonePaddingRatio` / `awayZonePaddingRatio` — inset before gap
- `homeAnchorXRatio` / `awayAnchorXRatio` — event cluster anchor within zone
- `homeClusterRadiusRatio` / `awayClusterRadiusRatio` — cluster size
- `homeEventJitterRatio` / `awayEventJitterRatio` — spawn scatter
- `homeInnerBias` / `awayInnerBias` — pull toward center-facing edge (without crossing gap)

---

## Config vs mappings

| File | Purpose |
|------|---------|
| `visualMappings.ts` | Meaning — which data key maps to which visual component |
| `src/config/` | Numbers — sizes, colors, speeds, zone boundaries |
| `posterLayout.ts` | Zone geometry — left/center/right bounds |
| `artState.ts` | Build — creates mark geometry, clamped to team zone |
| `posterRenderer.ts` | Draw — renders components each frame |
| `replayEngine.ts` | When — applies feed updates in order |

When art-directing: change **behavior/meaning** in mappings and this doc first, then tune **parameters** in config.

---

## Replay flow

1. **Kickoff** — sparse grids at ~50%, empty event marks, clear center gap
2. **State updates** — possession grids and pass-accuracy symbols morph
3. **Events** — append permanent marks on the correct team side + EventBurst
4. **Reset** — clears all marks, restarts from kickoff

Same feed + same seed → same final artwork (deterministic RNG).

---

## Art direction checklist

For each component, ask:

1. Does it match the **meaning** in the mapping?
2. Does it stay **entirely on its team's side**?
3. Is the **center gap** always empty?
4. Does it **accumulate density** over 90 minutes without scattering?
5. Does it **stay alive** with breathing/vibration while the match runs?

---

## File reference

```
src/design-system/mapping/visualMappings.ts  ← DATA_VISUAL_MAPPINGS (source of truth)
src/config/                                  ← numeric design tokens + composition.zones
src/design-system/layout/posterLayout.ts     ← three-zone layout geometry
src/design-system/state/artState.ts          ← addEventMark (zone-clamped spawn)
src/design-system/render/posterRenderer.ts   ← draw* functions
VISUAL_LANGUAGE.md                           ← this document
```
