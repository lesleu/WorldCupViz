import { notFound } from "next/navigation";
import MatchPageShell from "@/components/MatchPageShell";
import { getMatch } from "@/lib/matches/matchService";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const entry = await getMatch(id);

  if (!entry) {
    notFound();
  }

  return <MatchPageShell entry={entry} />;
}
