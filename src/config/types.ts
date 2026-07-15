/** Type definitions for the generative poster design system configuration. */

export interface DesignConfig {
  artboardWidth: number;
  artboardHeight: number;
}

export interface ColorsConfig {
  background: string;
  textMuted: string;
  text: string;
  cream: string;
  black: string;
  yellowCard: string;
  redCard: string;
  foulFill: string;
  offsideFill: string;
}

export interface TypographyConfig {
  teamNameSize: number;
  vsSize: number;
  metaSize: number;
  scoreSize: number;
  timelineLabelSize: number;
  logoLabelSize: number;
  fontFamily: string;
  /** Sans-serif face for zone background codes (MEX / KOR). */
  kickoffCodeFontFamily: string;
  kickoffCodeFontWeight: number;
  /** Target word width as a fraction of each team zone. */
  kickoffCodeFillWidthRatio: number;
  /** Target word height as a fraction of each team zone. */
  kickoffCodeFillHeightRatio: number;
  /** Letter spacing as a fraction of base letter size (e.g. -0.03 = -3% tracking). */
  kickoffCodeLetterGapRatio: number;
}

export interface LayoutConfig {
  posterPadding: number;
  headerHeight: number;
  artworkTopGap: number;
  artworkBottomGap: number;
  footerHeight: number;
  waveformAxisOffset: number;
  /** Top inset for MEX/KOR background type (keeps letters below header). */
  kickoffTypeTopInset: number;
  /** Vertical gap between match title and venue/date block. */
  headerMetaGap: number;
}

export interface TeamsConfig {
  /** @deprecated Team colors come from teamPalettes.generated.ts via team code. */
  homePrimary: string;
  homeSecondary: string;
  awayPrimary: string;
  awaySecondary: string;
}

export interface ShapesConfig {
  baseCircleSize: number;
  maxTerritoryScale: number;
  minTerritoryScale: number;
  awayStarOuter: number;
  awayStarInner: number;
  barHeight: number;
  barWidthMin: number;
  barWidthMax: number;
  shardMinSize: number;
  shardMaxSize: number;
  rayMinLength: number;
  rayMaxLength: number;
  rayLengthRatio: number;
  rayWeight: number;
  rayThinWeight: number;
  rayAccentEvery: number;
  rayCountBase: number;
  rayCountPerPossession: number;
  centerStrokeWeight: number;
  impactRingInnerScale: number;
  monumentBaseWidthRatio: number;
  monumentBaseHeightRatio: number;
  monumentTipOffsetRatio: number;
}

export interface PossessionConfig {
  gridRows: number;
  /** @deprecated Full-column grid replaced by asymmetric rows; kept for token math only. */
  gridCols: number;
  /** Circles placed per row (inclusive range). */
  circlesPerRowMin: number;
  circlesPerRowMax: number;
  /**
   * When possession circles are mosaic-placed (not a corner grid), how many
   * circles represent 100% possession. Count scales linearly with %.
   */
  placedCirclesAt100: number;
  /** Multiplier on Figma-derived circle diameter (<1 = smaller). */
  circleScale: number;
  filledOpacity: number;
  unfilledOpacity: number;
  homeGridCornerXRatio: number;
  awayGridCornerXRatio: number;
  gridCornerYRatio: number;
  gridBreathingAmount: number;
  /** Vertical jitter within a row band (fraction of row height). */
  rowJitterRatio: number;
  /** @deprecated Use circleScale. */
  circleFillRatio: number;
}

export interface ShotsConfig {
  squaresPerShot: number;
  /** Pattern tile size as fraction of shot square side (Figma ~4px on ~80px). */
  patternPixelRatio: number;
}

export interface ShotsOnTargetConfig {
  starInnerRatio: number;
  strokeWeight: number;
  innerEdgeBias: number;
}

export interface GoalsConfig {
  heightJitterMin: number;
  heightJitterMax: number;
  multiGoalSpacing: number;
  jaggedSegments: number;
  /** Jagged accent width as fraction of goal panel width. */
  accentWidthRatio: number;
  /** Jagged accent height as fraction of goal panel height. */
  accentHeightRatio: number;
  /** Non-goal marks cannot exceed first goal max dimension × this ratio. */
  markCapRatio: number;
  /** Max goal height as fraction of team zone height. */
  maxZoneHeightRatio: number;
  /** Max goal width as fraction of team zone width. */
  maxZoneWidthRatio: number;
  /** Penalty shootout goal panel background. */
  shootoutBg: string;
  /** Penalty shootout goal jagged pattern. */
  shootoutPattern: string;
}

export interface FoulsConfig {
  ovalCount: number;
  ovalWidthRatio: number;
  /** Oval height as fraction of square side. */
  ovalHeightRatio: number;
}

export interface CardsConfig {
  ovalCount: number;
  ovalWidthRatio: number;
  ovalHeightRatio: number;
}

export interface PassAccuracyConfig {
  cleanThreshold: number;
  cleanSparkCount: number;
  brokenSparkCount: number;
  minFragmentation: number;
  maxFragmentation: number;
  alignmentStrength: number;
}

export interface AnimationConfig {
  /** When true: no breathing, drift, shake, pulse, or spawn rotation jitter. */
  staticRender: boolean;
  /** Asset-only pulse on live fixtures — runs even when staticRender is true. */
  liveBreathingSpeed: number;
  liveBreathingAmount: number;
  liveUpdateSpeed: number;
  breathingSpeed: number;
  breathingAmount: number;
  breathingPossessionWeight: number;
  rayPulseSpeed: number;
  rayPulseAmount: number;
  driftSpeed: number;
  splatDriftSpeed: number;
  waveformSpeed: number;
  waveformAmplitude: number;
  waveformSpikeAmplitude: number;
  waveformSegments: number;
  updateSpeed: number;
  rotationSpeed: number;
}

export interface TextureConfig {
  grainAmount: number;
  paperNoiseOpacity: number;
  grainDotSize: number;
}

export interface RandomnessConfig {
  seed: number;
  positionJitter: number;
  sizeJitter: number;
  angleJitter: number;
  enableRandomVariation: boolean;
  eventMinuteMin: number;
  eventMinuteMax: number;
}

export interface ZoneRegion {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface CompositionZonesConfig {
  centerGapWidthRatio: number;
  homeZonePaddingRatio: number;
  awayZonePaddingRatio: number;
  homeAnchorXRatio: number;
  awayAnchorXRatio: number;
  anchorYRatio: number;
  homeClusterRadiusRatio: number;
  awayClusterRadiusRatio: number;
  homeEventJitterRatio: number;
  awayEventJitterRatio: number;
  homeInnerBias: number;
  awayInnerBias: number;
  /** Fraction of team zone width reserved for possession grid (corner). */
  gridRegionWidthRatio: number;
  /** Fraction of team zone height reserved for possession grid (corner). */
  gridRegionHeightRatio: number;
  /** Padding between grid region and mark region. */
  gridMarkGapRatio: number;
}

/** Per-component placement tuning — inner edge, vertical band, overlap tolerance. */
export interface EventPlacementProfile {
  /** Multiplier on zone innerBias (negative = prefer outer edge). */
  innerBiasMultiplier: number;
  /** -1 = lower rows, 0 = middle, 1 = upper rows. */
  rowBias: number;
  /** Added to max overlap threshold for this event type. */
  overlapBoost: number;
}

/** Rank-based size decay — see markSizes.config.ts. */
export interface MarkRankDecayRule {
  firstFullSizeCount: number;
  sizeDecayRatio: number;
  /** Goals use steps × this exponent (default 2). */
  goalDecayExponent?: number;
  /** Never shrink below this fraction of full size (keeps late marks visible). */
  minSizeMultiplier?: number;
}

/** Per-component mark size multipliers and rank decay — single tuning surface. */
export interface MarkSizesConfig {
  shotDesignBasePx: number;
  markSizeScale: Partial<Record<string, number>>;
  rankDecay: Partial<Record<string, MarkRankDecayRule>>;
}

export interface CompositionConfig {
  zones: CompositionZonesConfig;
  markScale: number;
  markScaleMin: number;
  markScaleMax: number;
  densityMultiplier: number;
  minScatterRatio: number;
  /** Max fraction of mark bbox that may overlap an existing mark (0–1). */
  maxOverlapRatio: number;
  /**
   * Overlap limits tried in order — fill empty cells first, then layer.
   * Last entry should equal maxOverlapRatio.
   */
  placementOverlapSteps: readonly number[];
  /** How strongly to prefer empty area when scoring candidates (higher = spread more). */
  emptyAreaPreference: number;
  /** Placement candidate grid columns over mark region. */
  placementCols: number;
  /** Placement candidate grid rows over mark region. */
  placementRows: number;
  /** Draw zone debug outlines on canvas. */
  showZoneDebug: boolean;
  /** First N marks per dataset (per side) render at full size before crowding. */
  crowdingFreeMarkCount: number;
  /** Shrink curve reference for marks beyond the free tier. */
  comfortableMarkCount: number;
  /** Floor for crowding scale when a dataset is very busy. */
  minCrowdingScale: number;
  /** Curve steepness — higher shrinks faster as count grows. */
  crowdingExponent: number;
  /** How strongly event minute maps to vertical band (0 = off). */
  timelineYWeight: number;
  /** Per-rank opacity multiplier for older marks (1 = no fade). */
  markAgeOpacityDecay: number;
  /** Blend Poisson-disk candidates with grid cells. */
  usePoissonCandidates: boolean;
  /** Visual-component keyed placement profiles. */
  eventPlacementProfiles: Record<string, EventPlacementProfile>;
}

export type MatchEventTypeKey =
  | "shot"
  | "shot_on_target"
  | "goal"
  | "foul"
  | "corner"
  | "offside"
  | "yellow_card"
  | "red_card"
  | "penalty_scored"
  | "penalty_missed";

export interface EnergyConfig {
  baseLevel: number;
  pausedLevel: number;
  idleLevel: number;
  smoothing: number;
  burstDecay: number;
  shakeDecay: number;
  burstInfluence: number;
  goalShakeBoost: number;
  motionFromLevel: number;
  motionFromBurst: number;
  shakeAmplitude: number;
  eventBurstStrength: Record<MatchEventTypeKey, number>;
}

export interface ReplayConfig {
  /** Regulation time length (90). Used for "full time" labels. */
  regulationMinutes: number;
  /** Maximum clock including stoppage time, extra time, and penalty shootout. */
  maxMatchMinutes: number;
  /** Feed/clock minute where penalty shootout marks begin (after ET). */
  penaltyShootoutStartMinute: number;
  /** @deprecated Use regulationMinutes — kept for backward compatibility. */
  matchDurationMinutes: number;
  minutesPerSecond: number;
  speedOptions: readonly [1, 2, 3, 4];
  continuousSmoothing: number;
  kickoffPresence: number;
  kickoffPhaseMinutes: number;
}

export interface CornersConfig {
  /** Triangle arm length as fraction of pinwheel size. */
  armLengthRatio: number;
  /** Triangle vertical spread as fraction of pinwheel size. */
  armSpreadRatio: number;
}

export interface OffsidesConfig {
  segmentCount: number;
  /** Gap between segments as fraction of total stack height. */
  segmentGapRatio: number;
  /** Corner radius as fraction of segment height. */
  segmentCornerRadiusRatio: number;
  /** Rotation step between stacked segments (radians). */
  segmentRotationStep: number;
}

/** Pattern layout for discrete event marks (chronological mosaic per team zone). */
export interface EventMarksConfig {
  foulBackground: string;
  offsideBackground: string;
  desaturateMix: number;
  artworkEdgePaddingRatio: number;
  centerEdgePaddingRatio: number;
  spiralSpreadRatio: number;
  zoneSpreadInset: number;
  crowdedScaleMin: number;
  crowdedScaleMax: number;
  minMarkPx: number;
  temporalFlowStrength: number;
  patternComponents: readonly string[];
}

/** Root configuration object for the generative poster system. */
export interface VisualizerConfig {
  design: DesignConfig;
  colors: ColorsConfig;
  typography: TypographyConfig;
  layout: LayoutConfig;
  teams: TeamsConfig;
  shapes: ShapesConfig;
  possession: PossessionConfig;
  shots: ShotsConfig;
  shotsOnTarget: ShotsOnTargetConfig;
  goals: GoalsConfig;
  fouls: FoulsConfig;
  cards: CardsConfig;
  passAccuracy: PassAccuracyConfig;
  animation: AnimationConfig;
  texture: TextureConfig;
  randomness: RandomnessConfig;
  composition: CompositionConfig;
  markSizes: MarkSizesConfig;
  energy: EnergyConfig;
  replay: ReplayConfig;
  corners: CornersConfig;
  offsides: OffsidesConfig;
  eventMarks: EventMarksConfig;
}
