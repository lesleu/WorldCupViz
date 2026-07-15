import { cfg } from "@/config";
import type { ZoneRegion } from "@/config/types";

export interface PosterLayout {
  margin: number;
  width: number;
  height: number;
  /** Bottom edge of the header chrome band (match title + meta). */
  titleBandBottom: number;
  headerBottom: number;
  artworkTop: number;
  artworkBottom: number;
  waveformTop: number;
  waveformBottom: number;
  centerGapLeft: number;
  centerGapRight: number;
  artworkWidth: number;
  artworkHeight: number;
  homeZone: TeamZone;
  awayZone: TeamZone;
  /** realone: teams share the full canvas, split along the anti-diagonal. */
  diagonalSplit: boolean;
}

/** Bounds and spawn anchor for one team's side of the canvas. */
export interface TeamZone {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  innerEdgeX: number;
  clusterRadius: number;
  /** Full side — possession grid fills this region. */
  gridRegion: ZoneRegion;
  /** Same bounds as gridRegion — marks overlap the grid. */
  markRegion: ZoneRegion;
}

export interface CompositionAnchors {
  homeX: number;
  homeY: number;
  awayX: number;
  awayY: number;
  homeClusterRadius: number;
  awayClusterRadius: number;
  homeEventJitter: number;
  awayEventJitter: number;
  homeInnerBias: number;
  awayInnerBias: number;
}

function buildRegion(left: number, right: number, top: number, bottom: number): ZoneRegion {
  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
  };
}

/** Corner possession block + full-zone mark collage (marks avoid grid corner in placement). */
function computeSubregions(
  zoneLeft: number,
  zoneRight: number,
  zoneTop: number,
  zoneBottom: number,
  side: "home" | "away",
  options: { fillGrid?: boolean } = {}
): { gridRegion: ZoneRegion; markRegion: ZoneRegion } {
  const markRegion = buildRegion(zoneLeft, zoneRight, zoneTop, zoneBottom);

  if (options.fillGrid) {
    return { gridRegion: markRegion, markRegion };
  }

  const zones = cfg.composition.zones;
  const zoneW = zoneRight - zoneLeft;
  const zoneH = zoneBottom - zoneTop;
  const gridW = zoneW * zones.gridRegionWidthRatio;
  const gridH = zoneH * zones.gridRegionHeightRatio;

  const gridRegion =
    side === "home"
      ? buildRegion(zoneLeft, zoneLeft + gridW, zoneTop, zoneTop + gridH)
      : buildRegion(zoneRight - gridW, zoneRight, zoneTop, zoneTop + gridH);

  return { gridRegion, markRegion };
}

function buildTeamZone(
  left: number,
  right: number,
  top: number,
  bottom: number,
  anchorXRatio: number,
  clusterRadiusRatio: number,
  side: "home" | "away",
  options: { fillGrid?: boolean } = {}
): TeamZone {
  const width = right - left;
  const height = bottom - top;
  const { gridRegion, markRegion } = computeSubregions(
    left,
    right,
    top,
    bottom,
    side,
    options
  );

  return {
    left,
    right,
    top,
    bottom,
    width,
    height,
    anchorX: left + width * anchorXRatio,
    anchorY: top + height * cfg.composition.zones.anchorYRatio,
    innerEdgeX: side === "home" ? right : left,
    clusterRadius: width * clusterRadiusRatio,
    gridRegion,
    markRegion,
  };
}

/** Compact header band sized to the match title + centered meta. */
function computeTitleBandBottom(): number {
  const { posterPadding, headerMetaGap } = cfg.layout;
  const matchTitleSize = cfg.typography.teamNameSize * 0.5;
  const metaSize = cfg.typography.metaSize + 1;
  const dateSize = metaSize - 1;
  const titleY = posterPadding + matchTitleSize * 0.55;
  const titleBottom = titleY + matchTitleSize * 0.45;
  const venueY = titleBottom + headerMetaGap;
  const dateY = venueY + metaSize + 2;
  return dateY + dateSize + posterPadding * 0.25;
}

function buildPosterLayout(
  width: number,
  height: number,
  artworkTop: number,
  artworkBottom: number,
  titleBandBottom: number,
  waveformTop: number,
  waveformBottom: number
): PosterLayout {
  const midX = width * 0.5;
  const zones = cfg.composition.zones;
  const artworkHeight = Math.max(artworkBottom - artworkTop, 1);
  const diagonalSplit = cfg.composition.diagonalSplit === true;
  const gapHalf = width * zones.centerGapWidthRatio * 0.5;
  // Diagonal split: both teams share the full artwork rect; the triangle
  // ownership + seam gap are enforced in the placement engine.
  const homeRight = diagonalSplit ? width : midX - gapHalf;
  const awayLeft = diagonalSplit ? 0 : midX + gapHalf;

  return {
    margin: 0,
    width,
    height,
    titleBandBottom,
    headerBottom: titleBandBottom,
    artworkTop,
    artworkBottom,
    waveformTop,
    waveformBottom,
    centerGapLeft: diagonalSplit ? midX : homeRight,
    centerGapRight: diagonalSplit ? midX : awayLeft,
    artworkWidth: width,
    artworkHeight,
    diagonalSplit,
    homeZone: buildTeamZone(
      0,
      homeRight,
      artworkTop,
      artworkBottom,
      zones.homeAnchorXRatio,
      zones.homeClusterRadiusRatio,
      "home"
    ),
    awayZone: buildTeamZone(
      awayLeft,
      width,
      artworkTop,
      artworkBottom,
      zones.awayAnchorXRatio,
      zones.awayClusterRadiusRatio,
      "away"
    ),
  };
}

export function computeLayout(width: number, height: number): PosterLayout {
  const { posterPadding, artworkBottomGap, artworkTopGap, footerHeight } = cfg.layout;

  const titleBandBottom = computeTitleBandBottom();
  const waveformBottom = height - Math.round(posterPadding * 0.5);
  const waveformTop = waveformBottom - footerHeight;
  const artworkTop = titleBandBottom + artworkTopGap;
  const artworkBottom = waveformTop - artworkBottomGap;

  return buildPosterLayout(
    width,
    height,
    artworkTop,
    artworkBottom,
    titleBandBottom,
    waveformTop,
    waveformBottom
  );
}

/** Artwork zone only — gradients, team codes, and generative marks (no header/footer). */
export function computeArtworkLayout(width: number, height: number): PosterLayout {
  return buildPosterLayout(width, height, 0, height, 0, height, height);
}

/** Layout for engine + renderer — full poster or single-team mobile panel. */
export function resolveArtworkLayout(
  width: number,
  height: number,
  teamSide?: "home" | "away"
): PosterLayout {
  return resolveRendererLayout(width, height, {
    artworkOnly: Boolean(teamSide),
    teamSide,
  });
}

/** Same layout logic as posterRenderer rebuildLayout (seek + draw must match). */
export function resolveRendererLayout(
  width: number,
  height: number,
  options: {
    artworkOnly?: boolean;
    teamSide?: "home" | "away";
    /** Full poster layout — artwork band cropped for card thumbnails. */
    posterArtworkCrop?: boolean;
  } = {}
): PosterLayout {
  const { artworkOnly = false, teamSide, posterArtworkCrop = false } = options;
  if (teamSide) {
    return computeSingleTeamArtworkLayout(width, height, teamSide);
  }
  if (posterArtworkCrop) {
    return computeLayout(width, height);
  }
  if (artworkOnly) {
    return computeArtworkLayout(width, height);
  }
  return computeLayout(width, height);
}

/** One team's artwork fills the canvas — for mobile stacked team panels. */
export function computeSingleTeamArtworkLayout(
  width: number,
  height: number,
  side: "home" | "away"
): PosterLayout {
  const zones = cfg.composition.zones;
  const homeRight = side === "home" ? width : 0;
  const awayLeft = side === "away" ? 0 : width;

  return {
    margin: 0,
    width,
    height,
    titleBandBottom: 0,
    headerBottom: 0,
    artworkTop: 0,
    artworkBottom: height,
    waveformTop: height,
    waveformBottom: height,
    centerGapLeft: homeRight,
    centerGapRight: awayLeft,
    artworkWidth: width,
    artworkHeight: height,
    diagonalSplit: false,
    homeZone: buildTeamZone(
      0,
      homeRight,
      0,
      height,
      zones.homeAnchorXRatio,
      zones.homeClusterRadiusRatio,
      "home",
      { fillGrid: side === "home" }
    ),
    awayZone: buildTeamZone(
      awayLeft,
      width,
      0,
      height,
      zones.awayAnchorXRatio,
      zones.awayClusterRadiusRatio,
      "away",
      { fillGrid: side === "away" }
    ),
  };
}

export function computeCompositionAnchors(layout: PosterLayout): CompositionAnchors {
  const zones = cfg.composition.zones;
  return {
    homeX: layout.homeZone.anchorX,
    homeY: layout.homeZone.anchorY,
    awayX: layout.awayZone.anchorX,
    awayY: layout.awayZone.anchorY,
    homeClusterRadius: layout.homeZone.clusterRadius,
    awayClusterRadius: layout.awayZone.clusterRadius,
    homeEventJitter: layout.homeZone.clusterRadius * zones.homeEventJitterRatio,
    awayEventJitter: layout.awayZone.clusterRadius * zones.awayEventJitterRatio,
    homeInnerBias: zones.homeInnerBias,
    awayInnerBias: zones.awayInnerBias,
  };
}

export function teamZoneForSide(layout: PosterLayout, side: "home" | "away"): TeamZone {
  return side === "home" ? layout.homeZone : layout.awayZone;
}

export function markRegionForSide(layout: PosterLayout, side: "home" | "away"): ZoneRegion {
  return teamZoneForSide(layout, side).markRegion;
}

export function gridRegionForSide(layout: PosterLayout, side: "home" | "away"): ZoneRegion {
  return teamZoneForSide(layout, side).gridRegion;
}
