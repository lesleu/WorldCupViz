import type { ColorsConfig } from "./types";
import { foundationsGenerated } from "./foundations.generated";

const F = foundationsGenerated;

/** Global foundation colors synced from Figma (poster chrome overrides for dark canvas). */
export const colorsConfig: ColorsConfig = {
  background: "#121212",
  cream: "#121212",
  text: "#EDE8E0",
  textMuted: "#A39E96",
  black: F.ink.mark,
  yellowCard: F.event.cardYellow,
  redCard: F.event.cardRed,
  foulFill: F.event.foul,
  offsideFill: F.event.offside,
};
