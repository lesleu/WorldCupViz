import { VISUAL_COMPONENT } from "@/design-system/mapping/visualMappings";
import type { CompositionConfig } from "./types";

/** Tuned toward design-tokens/reference/compositions/MEX-KOR-fulltime.png — see .cursor/rules/composition-reference.mdc */
export const compositionConfig: CompositionConfig = {
  zones: {
    centerGapWidthRatio: 0,
    homeZonePaddingRatio: 0,
    awayZonePaddingRatio: 0,
    homeAnchorXRatio: 0.5,
    awayAnchorXRatio: 0.5,
    anchorYRatio: 0.5,
    homeClusterRadiusRatio: 0.95,
    awayClusterRadiusRatio: 0.95,
    homeEventJitterRatio: 0,
    awayEventJitterRatio: 0,
    homeInnerBias: 0.38,
    awayInnerBias: 0.38,
    gridRegionWidthRatio: 0.52,
    gridRegionHeightRatio: 0.42,
    gridMarkGapRatio: 0.02,
  },
  markScale: 1.05,
  markScaleMin: 0.9,
  markScaleMax: 1.25,
  densityMultiplier: 1.15,
  minScatterRatio: 0,
  maxOverlapRatio: 0.28,
  placementOverlapSteps: [0, 0.08, 0.16, 0.24, 0.28],
  emptyAreaPreference: 2.5,
  placementCols: 10,
  placementRows: 14,
  showZoneDebug: false,
  crowdingFreeMarkCount: 5,
  comfortableMarkCount: 3,
  minCrowdingScale: 0.34,
  crowdingExponent: 0.52,
  timelineYWeight: 0.65,
  markAgeOpacityDecay: 0.85,
  usePoissonCandidates: true,
  eventPlacementProfiles: {
    [VISUAL_COMPONENT.Goal]: {
      innerBiasMultiplier: 1.15,
      rowBias: 0.85,
      overlapBoost: 0.06,
    },
    [VISUAL_COMPONENT.Shot]: {
      innerBiasMultiplier: 0.95,
      rowBias: 0,
      overlapBoost: 0.04,
    },
    [VISUAL_COMPONENT.ShotOnTarget]: {
      innerBiasMultiplier: 1.25,
      rowBias: 0.35,
      overlapBoost: 0.02,
    },
    [VISUAL_COMPONENT.Foul]: {
      innerBiasMultiplier: 0.85,
      rowBias: 0.15,
      overlapBoost: 0.1,
    },
    [VISUAL_COMPONENT.Corner]: {
      innerBiasMultiplier: -0.55,
      rowBias: -0.25,
      overlapBoost: 0.03,
    },
    [VISUAL_COMPONENT.Offside]: {
      innerBiasMultiplier: -0.45,
      rowBias: 0.1,
      overlapBoost: 0.03,
    },
    [VISUAL_COMPONENT.YellowCard]: {
      innerBiasMultiplier: 0.6,
      rowBias: -0.1,
      overlapBoost: -0.04,
    },
    [VISUAL_COMPONENT.RedCard]: {
      innerBiasMultiplier: 0.6,
      rowBias: -0.1,
      overlapBoost: -0.04,
    },
  },
  salienceSizes: {
    [VISUAL_COMPONENT.Shot]: {
      baseSizePx: 170,
      firstFullSizeCount: 2,
      sizeDecayRatio: 0.92,
    },
    [VISUAL_COMPONENT.ShotOnTarget]: {
      baseSizePx: 170,
      firstFullSizeCount: 2,
      sizeDecayRatio: 0.92,
    },
    [VISUAL_COMPONENT.Corner]: {
      useComponentTokens: true,
      firstFullSizeCount: 3,
      sizeDecayRatio: 0.9,
    },
    [VISUAL_COMPONENT.Offside]: {
      useComponentTokens: true,
      firstFullSizeCount: 3,
      sizeDecayRatio: 0.9,
    },
    [VISUAL_COMPONENT.Foul]: {
      useComponentTokens: true,
      firstFullSizeCount: 4,
      sizeDecayRatio: 0.88,
    },
    [VISUAL_COMPONENT.YellowCard]: {
      useComponentTokens: true,
      firstFullSizeCount: 5,
      sizeDecayRatio: 0.95,
    },
    [VISUAL_COMPONENT.RedCard]: {
      useComponentTokens: true,
      firstFullSizeCount: 5,
      sizeDecayRatio: 0.95,
    },
  },
};
