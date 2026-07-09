"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ backgroundColor: "#080a12", color: "#eaeaea" }}
    >
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md font-mono text-xs leading-relaxed text-[#948f87]">
        {error.message || "The page failed to render."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-white/20 px-4 py-2 font-mono text-xs uppercase tracking-widest"
      >
        Try again
      </button>
      <p className="max-w-md text-xs text-[#948f87]">
        If this keeps happening locally, run{" "}
        <code className="text-[#eaeaea]">npm run dev:clean</code> and hard-refresh
        the browser.
      </p>
    </div>
  );
}
