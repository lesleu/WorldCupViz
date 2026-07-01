import { VISUALIZER_CONFIG } from "@/config";

interface LiveBadgeProps {
  className?: string;
}

/** Pulsing LIVE indicator for in-progress fixtures. */
export default function LiveBadge({ className = "" }: LiveBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.25em] backdrop-blur-sm ${className}`}
      style={{ color: VISUALIZER_CONFIG.colors.text }}
      aria-label="Match is live"
    >
      <span
        className="live-badge-dot h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: VISUALIZER_CONFIG.colors.redCard }}
      />
      Live
    </span>
  );
}
