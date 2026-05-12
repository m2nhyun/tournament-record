import { ClubRecordEventWorkspaceView } from "@/features/club-record/components/club-record-event-workspace";

type ClubRecordEventPageProps = {
  params: Promise<{ clubId: string; eventId: string }>;
};

export default async function ClubRecordEventPage({
  params,
}: ClubRecordEventPageProps) {
  const { clubId, eventId } = await params;

  return <ClubRecordEventWorkspaceView clubId={clubId} eventId={eventId} />;
}
