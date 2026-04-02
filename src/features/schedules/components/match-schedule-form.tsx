"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
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
import { cn } from "@/lib/utils";
import {
  suggestedScheduleTimes,
  useMatchScheduleCreation,
} from "@/features/schedules/hooks/use-match-schedule-creation";
import type {
  MatchScheduleFormat,
  MatchScheduleJoinPolicy,
} from "@/features/schedules/types/schedule";
import {
  formatWon,
  scheduleFormatLabels,
  scheduleJoinPolicyLabels,
} from "@/features/schedules/utils/schedule-format";

type MatchScheduleFormProps = {
  clubId: string;
};

const scheduleFormats: MatchScheduleFormat[] = [
  "men_doubles",
  "women_doubles",
  "open_doubles",
];

const joinPolicyOptions: MatchScheduleJoinPolicy[] = [
  "instant",
  "approval_required",
];

const timeRangeOptions = suggestedScheduleTimes.map((value, index, array) => ({
  value,
  endLabel: array[index + 1] ?? "23:00",
}));

function formatSchedulePreview(date: string, startTime: string, endTime: string) {
  if (!date || !startTime || !endTime) return "날짜와 시간을 선택해주세요.";

  const startValue = new Date(`${date}T${startTime}:00`);
  const endValue = new Date(`${date}T${endTime}:00`);

  if (
    Number.isNaN(startValue.getTime()) ||
    Number.isNaN(endValue.getTime()) ||
    endValue.getTime() <= startValue.getTime()
  ) {
    return "선택한 일정 정보를 다시 확인해주세요.";
  }

  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(startValue);
  const timeLabel = new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dateLabel} ${timeLabel.format(startValue)} ~ ${timeLabel.format(endValue)}`;
}

export function MatchScheduleForm({ clubId }: MatchScheduleFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const {
    loadingMembers,
    submitting,
    status,
    createdScheduleId,
    canCreateSchedule,
    format,
    setFormat,
    joinPolicy,
    setJoinPolicy,
    date,
    setDate,
    selectedTimeSlots,
    toggleTimeSlot,
    startTime,
    endTime,
    setSelectedTimeSlots,
    setTimeRange,
    location,
    setLocation,
    courtFee,
    setCourtFee,
    ballFee,
    setBallFee,
    capacity,
    setCapacity,
    includeCourtFee,
    setIncludeCourtFee,
    includeBallFee,
    setIncludeBallFee,
    includeHost,
    setIncludeHost,
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
  const schedulePreview = useMemo(
    () => formatSchedulePreview(date, startTime, endTime),
    [date, endTime, startTime],
  );
  const selectedStartTime = startTime;
  const endTimeOptions = useMemo(() => {
    if (!selectedStartTime) return [];

    const startIndex = suggestedScheduleTimes.indexOf(selectedStartTime);
    if (startIndex < 0) return [];

    return timeRangeOptions.slice(startIndex + 1);
  }, [selectedStartTime]);
  const selectedEndTime = endTime;
  const totalFee =
    (includeCourtFee ? Number(courtFee || "0") : 0) +
    (includeBallFee ? Number(ballFee || "0") : 0);
  const feeSummary =
    Number.isFinite(totalFee) && totalFee > 0
      ? `${formatWon(totalFee)} 예상, 1인 약 ${formatWon(estimatedFeePerPerson)}`
      : "비용이 없거나 추후 공지 예정";
  const canMoveToStepTwo =
    location.trim().length >= 2 && Boolean(date) && Boolean(startTime) && Boolean(endTime);

  useEffect(() => {
    if (!createdScheduleId) return;
    router.push(`/clubs/${clubId}/schedules/${createdScheduleId}`);
  }, [clubId, createdScheduleId, router]);

  if (createdScheduleId) {
    return (
      <LoadingSpinner
        title="일정 상세로 이동 중"
        message="방금 만든 일정을 열고 있습니다..."
      />
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

      <Card className="border-[var(--brand)]/20 bg-[var(--brand)]/5">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={step === 1 ? "brand" : "default"}>1. 기본 정보</Badge>
              <Badge variant={step === 2 ? "brand" : "default"}>2. 비용과 모집</Badge>
            </div>
            <Badge>모집형 일정</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">운영진 빠른 입력</Badge>
            <Badge>{step === 1 ? "핵심 정보 먼저" : "마무리 확인"}</Badge>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              {step === 1 ? "날짜와 장소부터 빠르게 정하세요." : "모집 조건만 정리하면 생성됩니다."}
            </h2>
            <p className="text-sm text-muted-foreground">
              {step === 1
                ? "모바일에서 길게 스크롤하지 않도록 기본 정보와 모집 정보를 두 단계로 나눴습니다."
                : "기본 정보는 이미 고정됐습니다. 비용, 정원, 메모만 확인하고 바로 공개하세요."}
            </p>
          </div>
        </CardContent>
      </Card>

      {step === 1 ? (
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

            <div className="grid gap-2">
              <Label>참가 방식</Label>
              <div className="grid grid-cols-2 gap-2">
                {joinPolicyOptions.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={joinPolicy === option ? "default" : "outline"}
                    className={
                      joinPolicy === option
                        ? "bg-[var(--brand)] text-white hover:opacity-90"
                        : ""
                    }
                    onClick={() => setJoinPolicy(option)}
                  >
                    {scheduleJoinPolicyLabels[option]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {joinPolicy === "instant"
                  ? "클럽 멤버가 바로 참가자 목록에 들어오는 빠른 모집 방식입니다."
                  : "참가 신청을 받은 뒤 개설자가 수락해야 참가자로 확정됩니다."}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
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
                <Label htmlFor="schedule-start-time">시간 선택</Label>
                <div className="grid gap-2 rounded-2xl border bg-muted/20 p-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label
                      htmlFor="schedule-start-time"
                      className="text-xs text-muted-foreground"
                    >
                      시작
                    </Label>
                    <select
                      id="schedule-start-time"
                      value={selectedStartTime}
                      className="h-10 rounded-xl border bg-background px-3 text-sm"
                      onChange={(event) => {
                        const nextStart = event.target.value;
                        if (!nextStart) {
                          setSelectedTimeSlots([]);
                          return;
                        }

                        const nextStartIndex = suggestedScheduleTimes.indexOf(nextStart);
                        const currentEndIndex = suggestedScheduleTimes.indexOf(endTime);
                        const fallbackEnd =
                          suggestedScheduleTimes[nextStartIndex + 1] ?? "23:00";

                        if (currentEndIndex > nextStartIndex && endTime) {
                          setTimeRange(nextStart, endTime);
                          return;
                        }

                        setTimeRange(nextStart, fallbackEnd);
                      }}
                    >
                      <option value="">시작 선택</option>
                      {suggestedScheduleTimes.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label
                      htmlFor="schedule-end-time"
                      className="text-xs text-muted-foreground"
                    >
                      종료
                    </Label>
                    <select
                      id="schedule-end-time"
                      value={selectedEndTime}
                      className="h-10 rounded-xl border bg-background px-3 text-sm"
                      disabled={!selectedStartTime}
                      onChange={(event) =>
                        setTimeRange(selectedStartTime, event.target.value)
                      }
                    >
                      <option value="">종료 선택</option>
                      {endTimeOptions.map((option) => (
                        <option key={option.endLabel} value={option.endLabel}>
                          {option.endLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-2">
                  {suggestedScheduleTimes.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={
                        selectedTimeSlots.includes(option) ? "default" : "outline"
                      }
                      className={
                        selectedTimeSlots.includes(option)
                          ? "h-10 bg-[var(--brand)] px-2 text-white hover:opacity-90"
                          : "h-10 px-2"
                      }
                      onClick={() => toggleTimeSlot(option)}
                    >
                      <Clock3 className="size-3.5 shrink-0" />
                      {option}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  드롭다운으로 `몇 시부터 몇 시까지`를 먼저 고르고, 아래 시간칸으로
                  범위를 자연스럽게 미세 조정할 수 있습니다.
                </p>
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>비용과 모집</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">{schedulePreview}</div>
              <div className="mt-1 text-muted-foreground">{location.trim()}</div>
              <div className="mt-2 inline-flex">
                <Badge>{scheduleJoinPolicyLabels[joinPolicy]}</Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={includeCourtFee}
                    onChange={(event) => {
                      setIncludeCourtFee(event.target.checked);
                      if (!event.target.checked) setCourtFee("0");
                    }}
                  />
                  코트 비용 포함
                </label>
                <Input
                  id="schedule-court-fee"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={courtFee}
                  disabled={!includeCourtFee}
                  onChange={(event) => setCourtFee(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={includeBallFee}
                    onChange={(event) => {
                      setIncludeBallFee(event.target.checked);
                      if (!event.target.checked) setBallFee("0");
                    }}
                  />
                  캔볼 가격 포함
                </label>
                <Input
                  id="schedule-ball-fee"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={ballFee}
                  disabled={!includeBallFee}
                  onChange={(event) => setBallFee(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={includeHost}
                  onChange={(event) => setIncludeHost(event.target.checked)}
                />
                본인 포함
              </label>
              <Label htmlFor="schedule-capacity">
                모집 인원 {includeHost ? "(개설자 포함)" : "(개설자 제외)"}
              </Label>
              <Input
                id="schedule-capacity"
                type="number"
                min={includeHost ? "2" : "1"}
                max="8"
                inputMode="numeric"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Users className="size-4" />
                    {includeHost ? "개설자 포함 시작" : "개설자 제외 시작"} {participantCount}
                    명
                  </span>
                  <span className="font-semibold">남은 자리 {remainingSlots}명</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {includeHost
                    ? "체크 상태에서는 개설자가 자동 참가자로 포함됩니다."
                    : "체크를 끄면 개설자는 운영자로만 남고, 입력한 정원 전체를 모집 인원으로 사용합니다."}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
              코트 {formatWon(includeCourtFee ? Number(courtFee || "0") : 0)} +
              캔볼 {formatWon(includeBallFee ? Number(ballFee || "0") : 0)}
              <div className="mt-1 font-medium text-foreground">{feeSummary}</div>
              {!includeHost && totalFee > 0 ? (
                <div className="mt-1 text-xs">
                  개설자 제외 기준 인당 비용을 바로 보여줍니다.
                </div>
              ) : null}
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>생성 전 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">일정 시각</p>
              <p
                className={cn(
                  "mt-1 font-medium",
                  !startTime || !endTime ? "text-muted-foreground" : "",
                )}
              >
                {schedulePreview}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">복식 타입 / 정원 / 참가 방식</p>
              <p className="mt-1 font-medium">
                {scheduleFormatLabels[format]} · 총 {capacity || "0"}명
                {includeHost ? " (개설자 포함)" : " (개설자 제외)"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {scheduleJoinPolicyLabels[joinPolicy]}
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
              {joinPolicy === "instant"
                ? includeHost
                  ? "개설자는 자동 참가 처리되고, 클럽 홈 upcoming 일정 카드에서 참가/취소와 남은 자리 수가 바로 갱신됩니다."
                  : "개설자는 운영자로만 생성되고, 클럽 홈 upcoming 일정 카드에서 모집 인원과 남은 자리 수가 바로 갱신됩니다."
                : "참가자는 먼저 신청 대기 상태로 들어가고, 개설자가 수락한 뒤 참가자로 확정됩니다."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <MapPin className="size-4" />
          생성 즉시 반영되는 규칙
        </div>
        <p className="mt-2">
          {includeHost
            ? "개설자는 자동으로 참가자 1명으로 포함됩니다."
            : "개설자는 운영자로 남고, 참가자 목록에는 자동 포함되지 않습니다."}
        </p>
        <p className="mt-1">
          정회원은 일정 생성이 가능하고, 게스트는 생성된 일정에 참가만 가능합니다.
        </p>
        <p className="mt-1">
          승인형 모집은 신청/수락 흐름을 먼저 거치고, 바로 참가형은 기존처럼 즉시
          참가가 가능합니다.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {step === 2 ? (
          <Button
            variant="outline"
            className="w-full sm:flex-1"
            onClick={() => setStep(1)}
          >
            <ArrowLeft className="size-4" />
            기본 정보로 돌아가기
          </Button>
        ) : null}
        {step === 1 ? (
          <Button
            className="w-full bg-[var(--brand)] text-white hover:opacity-90 sm:flex-1"
            disabled={!canMoveToStepTwo}
            onClick={() => setStep(2)}
          >
            비용과 모집 설정
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            className="w-full bg-[var(--brand)] text-white hover:opacity-90 sm:flex-1"
            disabled={submitting}
            onClick={() => void submit()}
          >
            일정 만들기
          </Button>
        )}
      </div>
    </div>
  );
}
