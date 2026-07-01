import { NextResponse } from "next/server";
import { listMatches } from "@/lib/matches/matchService";
import type { TournamentStage } from "@/data/matchCatalog";

const STAGES = new Set<TournamentStage>([
  "group_stage",
  "round_of_32",
  "round_of_16",
  "quarterfinals",
  "semifinals",
  "third_place",
  "final",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stageParam = searchParams.get("stage");
  const stage =
    stageParam && STAGES.has(stageParam as TournamentStage)
      ? (stageParam as TournamentStage)
      : undefined;

  const result = await listMatches(stage);
  return NextResponse.json(result);
}
