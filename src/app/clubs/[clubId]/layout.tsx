import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { isUuid } from "@/lib/validation/uuid";

type ClubLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ clubId: string }>;
};

export default async function ClubLayout({
  children,
  params,
}: ClubLayoutProps) {
  const { clubId } = await params;

  if (!isUuid(clubId)) {
    redirect("/");
  }

  return <AppShell clubId={clubId}>{children}</AppShell>;
}
