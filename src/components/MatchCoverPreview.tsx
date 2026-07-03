import type { MatchCatalogEntry } from "@/data/matchCatalog";
import MatchCardCover from "@/components/MatchCardCover";

interface MatchCoverPreviewProps {
  entry: MatchCatalogEntry;
}

/** Card thumbnail — team gradient + abbreviated codes only. */
export default function MatchCoverPreview({ entry }: MatchCoverPreviewProps) {
  return <MatchCardCover entry={entry} />;
}
