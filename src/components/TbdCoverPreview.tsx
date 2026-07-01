import { VISUALIZER_CONFIG } from "@/config";

/** Greyed-out placeholder for fixtures with undetermined teams. */
export default function TbdCoverPreview() {
  return (
    <div
      className="flex aspect-video w-full items-center justify-center bg-[#1a1a1a]"
      style={{ color: VISUALIZER_CONFIG.colors.textMuted }}
    >
      <span className="font-mono text-2xl font-semibold uppercase tracking-[0.45em] opacity-40">
        TBD
      </span>
    </div>
  );
}
