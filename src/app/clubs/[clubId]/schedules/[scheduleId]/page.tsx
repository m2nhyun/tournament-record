import { MatchScheduleDetailView } from "@/features/schedules/components/match-schedule-detail";

type ScheduleDetailPageProps = {
  params: Promise<{ clubId: string; scheduleId: string }>;
};

export default async function ScheduleDetailPage({
  params,
}: ScheduleDetailPageProps) {
  const { clubId, scheduleId } = await params;

  return <MatchScheduleDetailView clubId={clubId} scheduleId={scheduleId} />;
}
