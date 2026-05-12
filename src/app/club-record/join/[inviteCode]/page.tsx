import { AppShell } from "@/components/layout/app-shell";
import { ClubRecordGuestJoinView } from "@/features/club-record/components/club-record-guest-join-view";

type ClubRecordGuestJoinPageProps = {
  params: Promise<{
    inviteCode: string;
  }>;
};

export default async function ClubRecordGuestJoinPage({
  params,
}: ClubRecordGuestJoinPageProps) {
  const { inviteCode } = await params;

  return (
    <AppShell>
      <ClubRecordGuestJoinView inviteCode={inviteCode} />
    </AppShell>
  );
}
