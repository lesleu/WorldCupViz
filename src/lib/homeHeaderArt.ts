import { COMPONENT_PATHS } from "@/design-system/assets/componentPaths.generated";
import {
  resolveHeaderArtPalette,
  type WorldArtPaletteKey,
} from "@/design-system/color/worldCupArt";
import { VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";
import type { TeamPalette } from "@/data/teamPalettes.generated";
import {
  HEADER_ART_EDGE_INSET,
  HEADER_ART_EDGE_INSET_BOTTOM,
  REF_HEADER_ART_HEIGHT,
  REF_HEADER_COMPACT_ASSET_SIZING_HEIGHT,
} from "@/lib/homeHeaderLayout";

function headerArtEdgeInset(compact: boolean): {
  x: number;
  top: number;
  bottom: number;
} {
  if (compact) return { x: 0, top: 0, bottom: 0 };
  return {
    x: HEADER_ART_EDGE_INSET,
    top: HEADER_ART_EDGE_INSET,
    bottom: HEADER_ART_EDGE_INSET_BOTTOM,
  };
}

export interface HomeHeaderArtOptions {
  compact: boolean;
}

export interface HomeHeaderArtPlacement {
  component: VisualComponent;
  palette: TeamPalette;
  xRatio: number;
  yRatio: number;
  sizeScale: number;
  /** Extra compact-only size multiplier (default 1). */
  compactScaleMul?: number;
}

type HeaderArtPlacementDef = Omit<HomeHeaderArtPlacement, "palette"> & {
  artPalette?: WorldArtPaletteKey;
};

const HEADER_ART_PLACEMENTS: HeaderArtPlacementDef[] = [
  {
    component: VISUAL_COMPONENT.Goal,
    xRatio: 0.505,
    yRatio: 0.64,
    sizeScale: 1.4,
    compactScaleMul: 0.5,
  },
  {
    component: VISUAL_COMPONENT.Goal,
    xRatio: 0.275,
    yRatio: 0.46,
    sizeScale: 0.6,
    compactScaleMul: 0.65,
  },
  {
    component: VISUAL_COMPONENT.Goal,
    xRatio: 0.805,
    yRatio: 0.36,
    sizeScale: 0.55,
  },
  {
    component: VISUAL_COMPONENT.Shot,
    artPalette: "world2",
    xRatio: 0.218,
    yRatio: 0.13,
    sizeScale: 0.85,
    compactScaleMul: 2,
  },
  {
    component: VISUAL_COMPONENT.Shot,
    artPalette: "world2",
    xRatio: 0.072,
    yRatio: 0.74,
    sizeScale: 1.05,
    compactScaleMul: 2 / 1.5,
  },
  {
    component: VISUAL_COMPONENT.Shot,
    xRatio: 0.148,
    yRatio: 0.2,
    sizeScale: 0.4,
  },
  {
    component: VISUAL_COMPONENT.Shot,
    xRatio: 0.392,
    yRatio: 0.8,
    sizeScale: 0.38,
  },
  {
    component: VISUAL_COMPONENT.Shot,
    xRatio: 0.718,
    yRatio: 0.54,
    sizeScale: 0.34,
    compactScaleMul: 2,
  },
  {
    component: VISUAL_COMPONENT.Shot,
    xRatio: 0.918,
    yRatio: 0.73,
    sizeScale: 0.48,
    compactScaleMul: 2,
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Full header sizing — unchanged from tuned “max” look. */
function fitFullAssetDimensions(
  component: VisualComponent,
  innerW: number,
  innerH: number
): { widthPx: number; heightPx: number } {
  const def = COMPONENT_PATHS[component];
  if (!def) {
    const fallback = Math.min(innerW, innerH) * 0.12;
    return { widthPx: fallback, heightPx: fallback };
  }

  const linear = innerH / REF_HEADER_ART_HEIGHT;
  const heightFactor = Math.max(linear * 0.72, 0.72);
  const { w, h } = def.viewBox;
  const maxW = innerW * 0.1 * heightFactor;
  const maxH = innerH * 0.36;
  const scale = Math.min(maxW / w, maxH / h);
  return { widthPx: w * scale, heightPx: h * scale };
}

/**
 * Compact header — same tuned sizes as the 100px compact header (no edge inset).
 * Uses a fixed sizing height so raising compact header height does not scale assets up.
 */
const COMPACT_ASSET_MULTIPLIER = 3;

function compactComponentSizeScale(component: VisualComponent): number {
  switch (component) {
    case VISUAL_COMPONENT.Shot:
      return 1 / 6;
    default:
      return 1;
  }
}

function fitCompactAssetDimensions(
  component: VisualComponent,
  innerW: number,
  innerH: number,
  placementScale: number,
  placementScaleMul = 1
): { widthPx: number; heightPx: number } {
  const def = COMPONENT_PATHS[component];
  if (!def) {
    const fallback = Math.min(innerW, innerH) * 0.55;
    return { widthPx: fallback, heightPx: fallback };
  }

  const sizingH = REF_HEADER_COMPACT_ASSET_SIZING_HEIGHT;
  const { w, h } = def.viewBox;
  const maxFillH = sizingH;
  const maxFillW = innerW;
  const baseScale = Math.min(maxFillW / w, maxFillH / h);
  const scaleMul = Math.max(placementScale, 0.72);
  const compactBoost = 1.18 * COMPACT_ASSET_MULTIPLIER;
  const compactSizeScale = 0.5;

  let widthPx =
    w *
    baseScale *
    scaleMul *
    compactBoost *
    compactSizeScale *
    compactComponentSizeScale(component) *
    placementScaleMul;
  let heightPx =
    h *
    baseScale *
    scaleMul *
    compactBoost *
    compactSizeScale *
    compactComponentSizeScale(component) *
    placementScaleMul;

  const fit = Math.min(1, innerW / widthPx, innerH / heightPx);
  widthPx *= fit;
  heightPx *= fit;

  return { widthPx, heightPx };
}

function fitFullAssetDimensionsForPlacement(
  placement: HomeHeaderArtPlacement,
  innerW: number,
  innerH: number
): { widthPx: number; heightPx: number } {
  const base = fitFullAssetDimensions(placement.component, innerW, innerH);
  let widthPx = base.widthPx * placement.sizeScale;
  let heightPx = base.heightPx * placement.sizeScale;

  const shrink = Math.min(1, innerW / widthPx, innerH / heightPx);
  widthPx *= shrink;
  heightPx *= shrink;

  return { widthPx, heightPx };
}

export function buildHomeHeaderArtPlacements(): HomeHeaderArtPlacement[] {
  return HEADER_ART_PLACEMENTS.map(({ artPalette, ...placement }) => ({
    ...placement,
    palette: resolveHeaderArtPalette(placement.component, artPalette),
  }));
}

export function resolveHomeHeaderArtPlacement(
  placement: HomeHeaderArtPlacement,
  width: number,
  height: number,
  { compact }: HomeHeaderArtOptions
) {
  const inset = headerArtEdgeInset(compact);
  const innerW = Math.max(width - inset.x * 2, 1);
  const innerH = Math.max(height - inset.top - inset.bottom, 1);

  let widthPx: number;
  let heightPx: number;

  if (compact) {
    ({ widthPx, heightPx } = fitCompactAssetDimensions(
      placement.component,
      innerW,
      innerH,
      placement.sizeScale,
      placement.compactScaleMul ?? 1
    ));
  } else {
    ({ widthPx, heightPx } = fitFullAssetDimensionsForPlacement(
      placement,
      innerW,
      innerH
    ));
  }

  const minX = inset.x + widthPx * 0.5;
  const maxX = width - inset.x - widthPx * 0.5;
  const minY = inset.top + heightPx * 0.5;
  const maxY = height - inset.bottom - heightPx * 0.5;

  const x = clamp(placement.xRatio * width, minX, maxX);
  const y = clamp(placement.yRatio * height, minY, maxY);

  return {
    ...placement,
    x,
    y,
    widthPx,
    heightPx,
  };
}

export function headerArtClipRect(
  width: number,
  height: number,
  { compact }: HomeHeaderArtOptions
) {
  const inset = headerArtEdgeInset(compact);
  return {
    left: inset.x,
    top: inset.top,
    width: Math.max(width - inset.x * 2, 1),
    height: Math.max(height - inset.top - inset.bottom, 1),
  };
}
