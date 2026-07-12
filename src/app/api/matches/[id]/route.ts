import { NextResponse } from "next/server";
import { getMatch } from "@/lib/matches/matchService";

// Live/just-completed status is resolved per request — do not cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const match = await getMatch(id);

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json({ match });
}
