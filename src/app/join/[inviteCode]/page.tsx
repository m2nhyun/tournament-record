import { AppShell } from "@/components/layout/app-shell";
import { InviteJoinView } from "@/features/clubs/components/invite-join-view";

type JoinByInvitePageProps = {
  params: Promise<{
    inviteCode: string;
  }>;
};

export default async function JoinByInvitePage({ params }: JoinByInvitePageProps) {
  const { inviteCode } = await params;

  return (
    <AppShell>
      <InviteJoinView inviteCode={inviteCode} />
    </AppShell>
  );
}
