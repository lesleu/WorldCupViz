import { NextResponse } from "next/server";
import { getMatchFeed } from "@/lib/matches/matchService";

// Live feeds must never be served from a cached response — resolve per request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const sinceMinuteRaw = searchParams.get("sinceMinute");
  const sinceMinute =
    sinceMinuteRaw != null ? Number(sinceMinuteRaw) : undefined;

  const feed = await getMatchFeed(
    id,
    Number.isFinite(sinceMinute) ? sinceMinute : undefined
  );

  return NextResponse.json(feed);
}
