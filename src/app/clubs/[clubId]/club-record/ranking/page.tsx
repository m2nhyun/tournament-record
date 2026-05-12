import { ClubRecordRankingView } from "@/features/club-record/components/club-record-ranking";

type ClubRecordRankingPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubRecordRankingPage({
  params,
}: ClubRecordRankingPageProps) {
  const { clubId } = await params;

  return <ClubRecordRankingView clubId={clubId} />;
}
