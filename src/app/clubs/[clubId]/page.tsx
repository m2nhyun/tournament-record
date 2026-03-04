import { ClubDetailView } from "@/features/clubs/components/club-detail";

type ClubPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubPage({ params }: ClubPageProps) {
  const { clubId } = await params;

  return <ClubDetailView clubId={clubId} />;
}
