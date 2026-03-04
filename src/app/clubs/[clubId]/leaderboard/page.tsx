import { LeaderboardView } from "@/features/leaderboard/components/leaderboard-table";

type LeaderboardPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function LeaderboardPage({
  params,
}: LeaderboardPageProps) {
  const { clubId } = await params;

  return <LeaderboardView clubId={clubId} />;
}
