"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  suggestedScheduleTimes,
  useMatchScheduleCreation,
} from "@/features/schedules/hooks/use-match-schedule-creation";
import type { MatchScheduleFormat } from "@/features/schedules/types/schedule";
import {
  formatWon,
  scheduleFormatLabels,
} from "@/features/schedules/utils/schedule-format";

type MatchScheduleFormProps = {
  clubId: string;
};

const scheduleFormats: MatchScheduleFormat[] = [
  "men_doubles",
  "women_doubles",
  "open_doubles",
];

function formatSchedulePreview(date: string, time: string) {
  if (!date || !time) return "날짜와 시간을 선택해주세요.";

  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) {
    return "선택한 일정 정보를 다시 확인해주세요.";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function getQuickDateOptions() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const nextSaturday = new Date(today);
  nextSaturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7));

  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7));

  const format = (value: Date) => value.toISOString().slice(0, 10);

  return [
    { label: "내일", value: format(tomorrow) },
    { label: "이번 토", value: format(nextSaturday) },
    { label: "이번 일", value: format(nextSunday) },
  ].filter(
    (item, index, array) =>
      array.findIndex((candidate) => candidate.value === item.value) === index,
  );
}

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
    estimatedFeePerPerson,
    submit,
  } = useMatchScheduleCreation(clubId);
  const selectedDate = useMemo(() => new Date(`${date}T00:00:00`), [date]);
  const minSelectableDate = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const quickDateOptions = useMemo(() => getQuickDateOptions(), []);
  const schedulePreview = useMemo(
    () => formatSchedulePreview(date, time),
    [date, time],
  );
  const totalFee = Number(courtFee || "0") + Number(ballFee || "0");
  const feeSummary =
    Number.isFinite(totalFee) && totalFee > 0
      ? `${formatWon(totalFee)} 예상, 1인 약 ${formatWon(estimatedFeePerPerson)}`
      : "비용이 없거나 추후 공지 예정";

  if (createdScheduleId) {
    return (
      <div className="space-y-4">
        {status ? (
          <StatusBox type={status.type} message={status.message} />
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" asChild>
            <Link href={`/clubs/${clubId}`}>클럽 홈</Link>
          </Button>
          <Button
            className="bg-[var(--brand)] text-white hover:opacity-90"
            asChild
          >
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
      {status ? (
        <StatusBox type={status.type} message={status.message} />
      ) : null}

      <Card className="border-[var(--brand)]/20 bg-[var(--brand)]/5">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">운영진 빠른 입력</Badge>
            <Badge>모집형 일정</Badge>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              정모나 번개 일정을 바로 열어두세요.
            </h2>
            <p className="text-sm text-muted-foreground">
              날짜, 시간, 장소를 먼저 정하고 비용과 모집 정보를 뒤에서 덧붙이는
              흐름으로 압축해 현장 입력 부담을 줄였습니다.
            </p>
          </div>
        </CardContent>
      </Card>

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
              현재 단계에서는 모집 조건으로만 저장합니다. 실제 성별 검증은 멤버
              프로필 정보가 들어온 뒤 연결할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>캘린더</Label>
                <div className="flex flex-wrap gap-2">
                  {quickDateOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={date === option.value ? "default" : "outline"}
                      className={
                        date === option.value
                          ? "bg-[var(--brand)] text-white hover:opacity-90"
                          : ""
                      }
                      onClick={() => setDate(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
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
              <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <CalendarClock className="size-4 text-[var(--brand)]" />
                  {schedulePreview}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  한 번에 한 일정만 열어두고 바로 공유할 수 있게 단일 일정 생성
                  흐름으로 유지합니다.
                </p>
              </div>
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
            <p className="text-xs text-muted-foreground">
              참가자가 바로 이해할 수 있게 테니스장 이름과 코트 번호를 함께 적는
              것을 권장합니다.
            </p>
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
                <span className="font-semibold">
                  남은 자리 {remainingSlots}명
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            코트 {formatWon(Number(courtFee || "0"))} + 캔볼{" "}
            {formatWon(Number(ballFee || "0"))}
            <div className="mt-1 font-medium text-foreground">{feeSummary}</div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="schedule-notes">메모</Label>
            <Textarea
              id="schedule-notes"
              rows={4}
              maxLength={240}
              value={notes}
              placeholder="예: 10분 전 집합, 우천 시 당일 공지"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>생성 전 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">일정 시각</p>
              <p className="mt-1 font-medium">{schedulePreview}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">복식 타입 / 정원</p>
              <p className="mt-1 font-medium">
                {scheduleFormatLabels[format]} · 총 {capacity || "0"}명
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">장소</p>
              <p className="mt-1 font-medium">
                {location.trim() || "아직 입력하지 않았습니다."}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">예상 비용</p>
              <p className="mt-1 font-medium">{feeSummary}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/10 p-3">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4 text-[var(--brand)]" />
              생성 후 바로 적용되는 내용
            </div>
            <p className="mt-2 text-muted-foreground">
              개설자는 자동 참가 처리되고, 클럽 홈 upcoming 일정 카드에서 참가/취소와
              남은 자리 수가 바로 갱신됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <MapPin className="size-4" />
          생성 즉시 반영되는 규칙
        </div>
        <p className="mt-2">개설자는 자동으로 참가자 1명으로 포함됩니다.</p>
        <p className="mt-1">
          정회원은 일정 생성이 가능하고, 게스트는 생성된 일정에 참가만
          가능합니다.
        </p>
        <p className="mt-1">
          채팅방과 실제 경기 기록 연결은 이 일정 엔티티를 기준으로 다음 단계에서
          붙일 수 있습니다.
        </p>
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
