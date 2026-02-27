import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
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
};

export function ClubList({ clubs, onMoveJoin }: ClubListProps) {
  if (clubs.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 py-12 text-center">
        <Users className="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p className="mb-4 text-sm text-muted-foreground">참여 중인 클럽이 없습니다.</p>
        <Button variant="outline" onClick={onMoveJoin}>
          클럽 참가하기
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {clubs.map((club) => (
        <article key={club.id} className="rounded-xl border bg-card px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{club.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                닉네임 {club.nickname} · 코드 {club.inviteCode}
              </p>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
              {club.role}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">생성일 {formatDate(club.createdAt)}</p>
        </article>
      ))}
    </div>
  );
}
