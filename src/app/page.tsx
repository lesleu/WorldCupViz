import GameGridHome from "@/components/GameGridHome";
import { listMatches } from "@/lib/matches/matchService";

export default async function HomePage() {
  const { matches, source, syncedAt } = await listMatches();

  return (
    <GameGridHome
      initialMatches={matches}
      dataSource={source}
      syncedAt={syncedAt}
    />
  );
}
