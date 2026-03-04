import { MatchHistoryView } from "@/features/matches/components/match-history";

type HistoryPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { clubId } = await params;

  return <MatchHistoryView clubId={clubId} />;
}
