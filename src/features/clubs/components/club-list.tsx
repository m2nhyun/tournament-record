import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ClubSummary } from "@/features/clubs/types/club";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

type ClubListProps = {
  clubs: ClubSummary[];
  onMoveJoin: () => void;
  onMoveCreate: () => void;
  canCreateClub: boolean;
};

export function ClubList({
  clubs,
  onMoveJoin,
  onMoveCreate,
  canCreateClub,
}: ClubListProps) {
  if (clubs.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 py-12 text-center">
        <Users className="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p className="mb-4 text-sm text-muted-foreground">
          참여 중인 클럽이 없습니다.
        </p>
        <div className="flex flex-col items-center justify-center gap-2 px-4 sm:flex-row">
          <Button variant="outline" onClick={onMoveJoin}>
            초대 링크로 참가
          </Button>
          {canCreateClub ? (
            <Button onClick={onMoveCreate}>새 클럽 만들기</Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          게스트는 참가만 가능하고, 클럽 생성은 정회원만 가능합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {clubs.map((club) => (
        <Link key={club.id} href={`/clubs/${club.id}`} className="block">
          <article className="rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{club.name}</h3>
                  <Badge>{club.role}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  닉네임 {club.nickname} · 코드 {club.inviteCode}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  생성일 {formatDate(club.createdAt)}
                </p>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}
