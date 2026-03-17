import { MatchCreationForm } from "@/features/matches/components/match-creation-form";

type NewMatchPageProps = {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function NewMatchPage({
  params,
  searchParams,
}: NewMatchPageProps) {
  const { clubId } = await params;
  const { mode } = await searchParams;

  return (
    <MatchCreationForm
      clubId={clubId}
      initialMode={mode === "schedule" ? "schedule" : "record"}
    />
  );
}
