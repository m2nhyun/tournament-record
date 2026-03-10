import Link from "next/link";

import { AppBar } from "@/components/layout/app-bar";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type JoinByInvitePageProps = {
  params: Promise<{
    inviteCode: string;
  }>;
};

export default async function JoinByInvitePage({ params }: JoinByInvitePageProps) {
  await params;

  return (
    <AppShell>
      <div className="space-y-4">
        <AppBar title="초대 링크" showBack />
        <div className="px-4">
          <Card>
            <CardHeader>
              <CardTitle>초대 링크 기능을 잠시 비활성화했습니다.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>현재는 참가 코드로만 클럽 참여가 가능합니다.</p>
              <Button variant="outline" asChild>
                <Link href="/">홈으로 이동</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
