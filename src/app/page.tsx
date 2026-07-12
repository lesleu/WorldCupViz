import HomePageClient from "@/components/home/HomePageClient";
import { listMatches } from "@/lib/matches/matchService";

// Home tiles must reflect live/completed status + art from the runtime overlay,
// not a build-time snapshot — resolve the schedule on each request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { matches } = await listMatches();
  return <HomePageClient initialMatches={matches} />;
}
