import { ClubRecordDashboardView } from "@/features/club-record/components/club-record-dashboard";

type ClubRecordPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubRecordPage({ params }: ClubRecordPageProps) {
  const { clubId } = await params;

  return <ClubRecordDashboardView clubId={clubId} />;
}
