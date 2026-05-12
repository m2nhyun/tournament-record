const SLOT_DURATION_MS = 30 * 60 * 1000;

type BuildClubRecordEventSlotsInput = {
  eventId: string;
  startsAt: string;
  endsAt: string;
  courtCount: number;
};

export type ClubRecordEventSlotInsert = {
  event_id: string;
  court_number: number;
  slot_order: number;
  starts_at: string;
  ends_at: string;
};

function parseTimestamp(value: string, label: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

function assertHalfHourBoundary(value: Date, label: string) {
  const minutes = value.getUTCMinutes();
  const seconds = value.getUTCSeconds();
  const milliseconds = value.getUTCMilliseconds();

  if ((minutes !== 0 && minutes !== 30) || seconds !== 0 || milliseconds !== 0) {
    throw new Error(`${label}은 30분 단위여야 합니다.`);
  }
}

export function buildClubRecordEventSlots(
  input: BuildClubRecordEventSlotsInput,
): ClubRecordEventSlotInsert[] {
  const startsAt = parseTimestamp(input.startsAt, "시작 시간");
  const endsAt = parseTimestamp(input.endsAt, "종료 시간");

  if (input.courtCount < 1) {
    throw new Error("코트 수는 1개 이상이어야 합니다.");
  }

  assertHalfHourBoundary(startsAt, "시작 시간");
  assertHalfHourBoundary(endsAt, "종료 시간");

  const durationMs = endsAt.getTime() - startsAt.getTime();
  if (durationMs <= 0) {
    throw new Error("종료 시간은 시작 시간보다 늦어야 합니다.");
  }
  if (durationMs < SLOT_DURATION_MS || durationMs % SLOT_DURATION_MS !== 0) {
    throw new Error("이벤트 시간은 30분 단위 슬롯으로 나누어져야 합니다.");
  }

  const slotCount = durationMs / SLOT_DURATION_MS;
  const slots: ClubRecordEventSlotInsert[] = [];

  for (let slotOrder = 1; slotOrder <= slotCount; slotOrder += 1) {
    const slotStartsAt = new Date(
      startsAt.getTime() + SLOT_DURATION_MS * (slotOrder - 1),
    );
    const slotEndsAt = new Date(slotStartsAt.getTime() + SLOT_DURATION_MS);

    for (let courtNumber = 1; courtNumber <= input.courtCount; courtNumber += 1) {
      slots.push({
        event_id: input.eventId,
        court_number: courtNumber,
        slot_order: slotOrder,
        starts_at: slotStartsAt.toISOString(),
        ends_at: slotEndsAt.toISOString(),
      });
    }
  }

  return slots;
}
