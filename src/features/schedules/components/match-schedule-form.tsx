"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarClock, Clock3, MapPin, Users } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  suggestedScheduleTimes,
  useMatchScheduleCreation,
} from "@/features/schedules/hooks/use-match-schedule-creation";
import {
  formatWon,
  scheduleFormatLabels,
} from "@/features/schedules/utils/schedule-format";
import type { MatchScheduleFormat } from "@/features/schedules/types/schedule";

type MatchScheduleFormProps = {
  clubId: string;
};

const scheduleFormats: MatchScheduleFormat[] = [
  "men_doubles",
  "women_doubles",
  "open_doubles",
];

export function MatchScheduleForm({ clubId }: MatchScheduleFormProps) {
  const {
    loadingMembers,
    submitting,
    status,
    createdScheduleId,
    canCreateSchedule,
    format,
    setFormat,
    date,
    setDate,
    time,
    setTime,
    location,
    setLocation,
    courtFee,
    setCourtFee,
    ballFee,
    setBallFee,
    capacity,
    setCapacity,
    notes,
    setNotes,
    participantCount,
    remainingSlots,
    submit,
  } = useMatchScheduleCreation(clubId);
  const selectedDate = useMemo(() => new Date(`${date}T00:00:00`), [date]);
  const minSelectableDate = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);

  if (createdScheduleId) {
    return (
      <div className="space-y-4">
        {status ? <StatusBox type={status.type} message={status.message} /> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" asChild>
            <Link href={`/clubs/${clubId}`}>클럽 홈</Link>
          </Button>
          <Button className="bg-[var(--brand)] text-white hover:opacity-90" asChild>
            <Link href={`/clubs/${clubId}`}>일정 확인하기</Link>
          </Button>
        </div>
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          일정 ID: {createdScheduleId}
        </div>
      </div>
    );
  }

  if (loadingMembers) {
    return (
      <LoadingSpinner
        title="일정 준비 중"
        message="클럽 멤버와 권한 정보를 불러오는 중..."
      />
    );
  }

  if (!canCreateSchedule) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="게스트는 일정을 만들 수 없습니다."
        description="정회원(카카오/이메일 로그인)만 일정 생성이 가능하며, 게스트는 생성된 일정에 참가만 할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-4">
      {status ? <StatusBox type={status.type} message={status.message} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>일정 기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>복식 타입</Label>
            <div className="grid grid-cols-3 gap-2">
              {scheduleFormats.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={format === item ? "default" : "outline"}
                  className={
                    format === item
                      ? "bg-[var(--brand)] text-white hover:opacity-90"
                      : ""
                  }
                  onClick={() => setFormat(item)}
                >
                  {scheduleFormatLabels[item]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              현재 단계에서는 모집 조건으로만 저장합니다. 실제 성별 검증은 멤버 프로필 정보가 들어온 뒤 연결할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid gap-2">
              <Label>캘린더</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(nextDate) => {
                  if (!nextDate) return;
                  const year = nextDate.getFullYear();
                  const month = String(nextDate.getMonth() + 1).padStart(2, "0");
                  const day = String(nextDate.getDate()).padStart(2, "0");
                  setDate(`${year}-${month}-${day}`);
                }}
                disabled={{ before: minSelectableDate }}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="schedule-time">시간 선택</Label>
              <div className="grid grid-cols-2 gap-2">
                {suggestedScheduleTimes.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={time === option ? "default" : "outline"}
                    className={
                      time === option
                        ? "bg-[var(--brand)] text-white hover:opacity-90"
                        : ""
                    }
                    onClick={() => setTime(option)}
                  >
                    <Clock3 className="size-3.5" />
                    {option}
                  </Button>
                ))}
              </div>
              <div className="grid gap-2 rounded-2xl border bg-muted/20 p-3">
                <Label htmlFor="schedule-time">직접 시간 입력</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="schedule-location">장소</Label>
            <Input
              id="schedule-location"
              value={location}
              placeholder="예: 올림픽공원 테니스장 3번 코트"
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>비용과 모집</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="schedule-court-fee">코트 비용</Label>
              <Input
                id="schedule-court-fee"
                type="number"
                min="0"
                inputMode="numeric"
                value={courtFee}
                onChange={(event) => setCourtFee(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schedule-ball-fee">캔볼 가격</Label>
              <Input
                id="schedule-ball-fee"
                type="number"
                min="0"
                inputMode="numeric"
                value={ballFee}
                onChange={(event) => setBallFee(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="schedule-capacity">모집 인원</Label>
            <Input
              id="schedule-capacity"
              type="number"
              min="2"
              max="8"
              inputMode="numeric"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Users className="size-4" />
                  본인 포함 {participantCount}명
                </span>
                <span className="font-semibold">남은 자리 {remainingSlots}명</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            코트 {formatWon(Number(courtFee || "0"))} + 캔볼 {formatWon(Number(ballFee || "0"))}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="schedule-notes">메모</Label>
            <Textarea
              id="schedule-notes"
              rows={4}
              maxLength={240}
              value={notes}
              placeholder="예: 2시간, 새 공 2캔 사용 예정"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <MapPin className="size-4" />
          생성 즉시 반영되는 규칙
        </div>
        <p className="mt-2">개설자는 자동으로 참가자 1명으로 포함됩니다.</p>
        <p className="mt-1">정회원은 일정 생성이 가능하고, 게스트는 생성된 일정에 참가만 가능합니다.</p>
        <p className="mt-1">채팅방과 실제 경기 기록 연결은 이 일정 엔티티를 기준으로 다음 단계에서 붙일 수 있습니다.</p>
      </div>

      <Button
        className="w-full bg-[var(--brand)] text-white hover:opacity-90"
        disabled={submitting}
        onClick={() => void submit()}
      >
        일정 만들기
      </Button>
    </div>
  );
}
