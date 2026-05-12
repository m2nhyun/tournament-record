import { ClubDetailView } from "@/features/clubs/components/club-detail";

type ClubInfoPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubInfoPage({ params }: ClubInfoPageProps) {
  const { clubId } = await params;

  return <ClubDetailView clubId={clubId} />;
}
