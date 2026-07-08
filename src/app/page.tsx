import GameGridHome from "@/components/GameGridHome";
import { listMatches } from "@/lib/matches/matchService";

/** Cache homepage catalog — avoids re-fetching on back navigation. */
export const revalidate = 300;

export default async function HomePage() {
  const { matches } = await listMatches();

  return <GameGridHome initialMatches={matches} />;
}
