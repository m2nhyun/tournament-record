import { MatchCreationForm } from "@/features/matches/components/match-creation-form";

type EditMatchPageProps = {
  params: Promise<{ clubId: string; matchId: string }>;
};

export default async function EditMatchPage({ params }: EditMatchPageProps) {
  const { clubId, matchId } = await params;

  return <MatchCreationForm clubId={clubId} matchId={matchId} />;
}
