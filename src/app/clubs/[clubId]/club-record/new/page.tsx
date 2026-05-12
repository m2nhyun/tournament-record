import { ClubRecordEventFormView } from "@/features/club-record/components/club-record-event-form";

type ClubRecordNewEventPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubRecordNewEventPage({
  params,
}: ClubRecordNewEventPageProps) {
  const { clubId } = await params;

  return <ClubRecordEventFormView clubId={clubId} />;
}
