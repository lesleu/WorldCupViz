import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/matches/cronAuth";
import { runMorningBackfill } from "@/lib/matches/matchPoll";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runMorningBackfill();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Morning backfill failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 }
    );
  }
}
