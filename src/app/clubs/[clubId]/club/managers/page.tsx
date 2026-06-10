import { ClubManagerView } from "@/features/clubs/components/club-manager-view";

type ClubManagersPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubManagersPage({ params }: ClubManagersPageProps) {
  const { clubId } = await params;

  return <ClubManagerView clubId={clubId} />;
}
