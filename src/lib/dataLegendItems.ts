import { VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";

export interface DataLegendItem {
  label: string;
  component: VisualComponent;
  /** Neutral grey goal styling for penalty shootout marks. */
  legendStyle?: "pkScored";
}

export const DATA_LEGEND_ITEMS: readonly DataLegendItem[] = [
  { label: "Possession", component: VISUAL_COMPONENT.PossessionGrid },
  { label: "Pass Accuracy", component: VISUAL_COMPONENT.PassAccuracy },
  { label: "Shots", component: VISUAL_COMPONENT.Shot },
  { label: "Shots on Target", component: VISUAL_COMPONENT.ShotOnTarget },
  { label: "Goals", component: VISUAL_COMPONENT.Goal },
  { label: "PK Scored", component: VISUAL_COMPONENT.Goal, legendStyle: "pkScored" },
  { label: "Corners", component: VISUAL_COMPONENT.Corner },
  { label: "Offsides", component: VISUAL_COMPONENT.Offside },
  { label: "Fouls", component: VISUAL_COMPONENT.Foul },
  { label: "Yellow Cards", component: VISUAL_COMPONENT.YellowCard },
  { label: "Red Cards", component: VISUAL_COMPONENT.RedCard },
];
