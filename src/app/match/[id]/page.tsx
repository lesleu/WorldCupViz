import { notFound } from "next/navigation";
import MatchPageShell from "@/components/MatchPageShell";
import { getMatch, getMatchFeed } from "@/lib/matches/matchService";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const [entry, initialFeed] = await Promise.all([getMatch(id), getMatchFeed(id)]);

  if (!entry) {
    notFound();
  }

  return <MatchPageShell entry={entry} initialFeed={initialFeed} />;
}
