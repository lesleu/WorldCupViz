import HomePageClient from "@/components/home/HomePageClient";
import { listMatches } from "@/lib/matches/matchService";

export default async function HomePage() {
  const { matches } = await listMatches();
  return <HomePageClient initialMatches={matches} />;
}
