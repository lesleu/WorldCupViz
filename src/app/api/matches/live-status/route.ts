import { NextResponse } from "next/server";
import { fetchLiveStatusPatches } from "@/lib/matches/liveStatus";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await fetchLiveStatusPatches();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Live status fetch failed:", error);
    return NextResponse.json(
      {
        at: new Date().toISOString(),
        patches: [],
        error: error instanceof Error ? error.message : "Live status fetch failed",
      },
      { status: 502 }
    );
  }
}
