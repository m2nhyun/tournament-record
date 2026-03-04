import { AppShell } from "@/components/layout/app-shell";

type ClubLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ clubId: string }>;
};

export default async function ClubLayout({
  children,
  params,
}: ClubLayoutProps) {
  const { clubId } = await params;

  return <AppShell clubId={clubId}>{children}</AppShell>;
}
