import { AppShell } from "@/components/layout/app-shell";
import { ClubDashboard } from "@/features/clubs/components/club-dashboard";

export default function HomePage() {
  return (
    <AppShell>
      <ClubDashboard />
    </AppShell>
  );
}
