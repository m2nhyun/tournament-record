import { ClubRecordEventListView } from "@/features/club-record/components/club-record-event-list";

type ClubRecordEventsPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubRecordEventsPage({
  params,
}: ClubRecordEventsPageProps) {
  const { clubId } = await params;

  return <ClubRecordEventListView clubId={clubId} />;
}
