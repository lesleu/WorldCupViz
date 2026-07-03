import GameGridHome from "@/components/GameGridHome";
import { listMatches } from "@/lib/matches/matchService";

export default async function HomePage() {
  const { matches } = await listMatches();

  return <GameGridHome initialMatches={matches} />;
}
