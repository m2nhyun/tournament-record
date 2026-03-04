import { MatchCreationForm } from "@/features/matches/components/match-creation-form";

type NewMatchPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function NewMatchPage({ params }: NewMatchPageProps) {
  const { clubId } = await params;

  return <MatchCreationForm clubId={clubId} />;
}
