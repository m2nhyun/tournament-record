"use client";

import { memo, useCallback, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { AppBar } from "@/components/layout/app-bar";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClubRanking } from "@/features/club-record/hooks/use-club-ranking";
import { useClubRecordAccess } from "@/features/club-record/hooks/use-club-record-access";
import type { ClubRecordMember } from "@/features/club-record/types/member";

type ClubRecordRankingViewProps = {
  clubId: string;
};

type SortableRankingRowProps = {
  member: ClubRecordMember;
  index: number;
  total: number;
  canEdit: boolean;
  onMove: (fromIndex: number, toIndex: number) => void;
};

function SortableRankingRowImpl({
  member,
  index,
  total,
  canEdit,
  onMove,
}: SortableRankingRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id, disabled: !canEdit });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
        {member.rankingPosition}
      </div>
      <p className="min-w-0 flex-1 break-words font-medium">
        {member.nickname}
      </p>
      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="size-8 p-0"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label="위로"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="size-8 p-0"
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label="아래로"
          >
            <ChevronDown className="size-4" />
          </Button>
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="ml-1 flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label="드래그로 순서 변경"
          >
            <GripVertical className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

const SortableRankingRow = memo(SortableRankingRowImpl);

export function ClubRecordRankingView({ clubId }: ClubRecordRankingViewProps) {
  const {
    access,
    loading: accessLoading,
    error: accessError,
  } = useClubRecordAccess(clubId);
  const canViewRanking = access?.capabilities.canViewRanking ?? false;
  const { members, loading, error, reorder, refresh, syncMembers } =
    useClubRanking(clubId, canViewRanking);
  const [status, setStatus] = useState<null | {
    type: "success" | "error";
    message: string;
  }>(null);
  const [syncing, setSyncing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleMove = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      void (async () => {
        try {
          await reorder(fromIndex, toIndex);
          setStatus(null);
        } catch (err) {
          setStatus({
            type: "error",
            message: err instanceof Error ? err.message : "랭킹 변경 실패",
          });
        }
      })();
    },
    [reorder],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const fromIndex = members.findIndex((member) => member.id === active.id);
      const toIndex = members.findIndex((member) => member.id === over.id);
      if (fromIndex === -1 || toIndex === -1) return;
      handleMove(fromIndex, toIndex);
    },
    [members, handleMove],
  );

  const handleSyncMembers = async () => {
    setSyncing(true);
    setStatus(null);
    try {
      const insertedCount = await syncMembers();
      setStatus({
        type: "success",
        message:
          insertedCount > 0
            ? `${insertedCount}명의 활성 회원을 랭킹에 추가했습니다.`
            : "추가할 활성 회원이 없습니다.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "클럽 회원 불러오기 실패",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (accessLoading || (canViewRanking && loading)) {
    return (
      <LoadingSpinner
        title="로딩 중"
        message="클럽 회원 랭킹을 불러오는 중..."
      />
    );
  }

  if (accessError || error || !access) {
    return (
      <div className="space-y-4">
        <AppBar title="클럽 회원 랭킹" />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox
            type="error"
            message={accessError ?? error ?? "랭킹을 불러오지 못했습니다."}
          />
        </div>
      </div>
    );
  }

  if (!access.capabilities.canViewRanking) {
    return (
      <div className="space-y-4">
        <AppBar title="클럽 회원 랭킹" />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox
            type="error"
            message="랭킹은 운영진 이상만 조회할 수 있습니다."
          />
        </div>
      </div>
    );
  }

  const canEdit = access.capabilities.canEditRanking;
  const memberIds = members.map((member) => member.id);

  return (
    <div className="space-y-6">
      <AppBar
        title="클럽 회원 랭킹"
        actions={
          <Button
            size="sm"
            variant="outline"
            aria-label="랭킹 다시 불러오기"
            onClick={() => void refresh()}
          >
            <RefreshCw className="size-4" />
          </Button>
        }
      />
      <div className="space-y-4 px-4 pb-24">
        {status ? <StatusBox type={status.type} message={status.message} /> : null}

        <Card className="border-[var(--brand)]/20 bg-[var(--brand)]/5">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base font-semibold">클럽 회원 랭킹</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  자동 편성 시 우선순위로 사용하는 회원 순서입니다.
                </p>
              </div>
              <Badge variant={canEdit ? "brand" : "default"}>
                {access.roleLabel}
              </Badge>
            </div>
            {canEdit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleSyncMembers()}
                disabled={syncing}
              >
                <Users className="size-4" />
                {syncing ? "불러오는 중..." : "클럽 회원 불러오기"}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="아직 클럽 회원 랭킹이 없습니다."
            description="활성 클럽 회원을 불러온 뒤 순서를 조정하세요."
            actionLabel={canEdit ? "클럽 회원 불러오기" : undefined}
            onAction={canEdit ? () => void handleSyncMembers() : undefined}
          />
        ) : null}

        {members.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>회원 순서</CardTitle>
            </CardHeader>
            <CardContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={memberIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {members.map((member, index) => (
                      <SortableRankingRow
                        key={member.id}
                        member={member}
                        index={index}
                        total={members.length}
                        canEdit={canEdit}
                        onMove={handleMove}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
