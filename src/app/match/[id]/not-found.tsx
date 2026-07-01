import Link from "next/link";
import { VISUALIZER_CONFIG } from "@/config";

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        color: VISUALIZER_CONFIG.colors.text,
      }}
    >
      <h1 className="text-xl font-semibold">Match not found</h1>
      <p className="text-sm" style={{ color: VISUALIZER_CONFIG.colors.textMuted }}>
        That fixture is not in the demo catalog yet.
      </p>
      <Link
        href="/"
        className="rounded-md border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-widest"
        style={{ color: VISUALIZER_CONFIG.colors.text }}
      >
        ← All matches
      </Link>
    </main>
  );
}
