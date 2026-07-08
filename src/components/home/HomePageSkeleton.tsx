import { VISUALIZER_CONFIG } from "@/config";

export default function HomePageSkeleton() {
  return (
    <div
      className="h-screen w-full overflow-hidden"
      style={{
        backgroundColor: VISUALIZER_CONFIG.colors.background,
        color: VISUALIZER_CONFIG.colors.text,
      }}
    >
      <div className="px-6 pt-10 pb-6">
        <div className="h-24 animate-pulse rounded-lg bg-white/5" />
      </div>
      <div className="space-y-6 px-6">
        <div className="h-8 w-40 animate-pulse rounded bg-white/5" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-white/10"
            >
              <div className="aspect-video animate-pulse bg-white/5" />
              <div className="space-y-2 px-4 py-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
