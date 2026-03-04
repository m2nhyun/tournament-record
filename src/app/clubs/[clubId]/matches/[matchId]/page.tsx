import { MatchDetailView } from "@/features/matches/components/match-detail";

type MatchPageProps = {
  params: Promise<{ clubId: string; matchId: string }>;
};

export default async function MatchPage({ params }: MatchPageProps) {
  const { clubId, matchId } = await params;

  return <MatchDetailView matchId={matchId} clubId={clubId} />;
}
