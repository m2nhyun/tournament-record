import { ClubRecordHistoryView } from "@/features/club-record/components/club-record-history";

type ClubRecordHistoryPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubRecordHistoryPage({
  params,
}: ClubRecordHistoryPageProps) {
  const { clubId } = await params;

  return <ClubRecordHistoryView clubId={clubId} />;
}
