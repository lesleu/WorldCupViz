import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/matches/cronAuth";
import { runPollTick } from "@/lib/matches/matchPoll";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPollTick();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron poll failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Poll failed" },
      { status: 500 }
    );
  }
}
