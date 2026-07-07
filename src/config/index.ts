/**
 * Generative design system — assembled configuration.
 * Individual token files live alongside this module in `src/config/`.
 */

import { markSizesConfig } from "./markSizes.config";
import { animationConfig } from "./animation.config";
import { cardsConfig } from "./cards.config";
import { colorsConfig } from "./colors.config";
import { compositionConfig } from "./composition.config";
import { cornersConfig } from "./corners.config";
import { designConfig } from "./design.config";
import { energyConfig } from "./energy.config";
import { eventMarksConfig } from "./eventMarks.config";
import { foulsConfig } from "./fouls.config";
import { goalsConfig } from "./goals.config";
import { layoutConfig } from "./layout.config";
import { offsidesConfig } from "./offsides.config";
import { passAccuracyConfig } from "./passAccuracy.config";
import { possessionConfig } from "./possession.config";
import { randomnessConfig } from "./randomness.config";
import { replayConfig } from "./replay.config";
import { shapesConfig } from "./shapes.config";
import { shotsConfig } from "./shots.config";
import { shotsOnTargetConfig } from "./shotsOnTarget.config";
import { teamsConfig } from "./teams.config";
import { textureConfig } from "./texture.config";
import { typographyConfig } from "./typography.config";
import type { VisualizerConfig } from "./types";

export type {
  AnimationConfig,
  CardsConfig,
  ColorsConfig,
  CompositionConfig,
  EventPlacementProfile,
  EventMarksConfig,
  MarkRankDecayRule,
  MarkSizesConfig,
  CornersConfig,
  DesignConfig,
  EnergyConfig,
  FoulsConfig,
  GoalsConfig,
  LayoutConfig,
  OffsidesConfig,
  PassAccuracyConfig,
  PossessionConfig,
  RandomnessConfig,
  ReplayConfig,
  ShapesConfig,
  ShotsConfig,
  ShotsOnTargetConfig,
  TeamsConfig,
  TextureConfig,
  TypographyConfig,
  VisualizerConfig,
} from "./types";

export const VISUALIZER_CONFIG: VisualizerConfig = {
  design: designConfig,
  colors: colorsConfig,
  typography: typographyConfig,
  layout: layoutConfig,
  teams: teamsConfig,
  shapes: shapesConfig,
  possession: possessionConfig,
  shots: shotsConfig,
  shotsOnTarget: shotsOnTargetConfig,
  goals: goalsConfig,
  fouls: foulsConfig,
  cards: cardsConfig,
  passAccuracy: passAccuracyConfig,
  animation: animationConfig,
  texture: textureConfig,
  randomness: randomnessConfig,
  composition: compositionConfig,
  markSizes: markSizesConfig,
  energy: energyConfig,
  replay: replayConfig,
  corners: cornersConfig,
  offsides: offsidesConfig,
  eventMarks: eventMarksConfig,
};

/** Shorthand alias used inside sketch modules */
export const cfg = VISUALIZER_CONFIG;
