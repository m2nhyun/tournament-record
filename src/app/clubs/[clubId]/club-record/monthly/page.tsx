import { ClubRecordMonthlyCardView } from "@/features/club-record/components/club-record-monthly-card";

type ClubRecordMonthlyCardPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubRecordMonthlyCardPage({
  params,
}: ClubRecordMonthlyCardPageProps) {
  const { clubId } = await params;

  return <ClubRecordMonthlyCardView clubId={clubId} />;
}
