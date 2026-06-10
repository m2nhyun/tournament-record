// 24명 시나리오 고정 입력.
// - 회원 20명: 여 4 / 남 16
// - 게스트 4명: 여 2 / 남 2
// - 닉네임/이메일 prefix는 결정론적이라 시드/cleanup이 멱등.
//
// `slot`은 fixture 정의 순서. ranking_position은 회원이 클럽에 합류한 순서
// (= owner=1, member-01..19 = 2..20) 그대로 부여된 뒤 sync_club_record_members가 group A/B/C를 자동 계산한다.

export const CLUB_NAME_PREFIX = "QA Full-Club Test";
export const EMAIL_DOMAIN = "tournament-record.local";
export const PASSWORD = "qa-full-club-pass!1";

export const MEMBERS = [
  // owner는 항상 첫 번째
  { slot: 1, role: "owner", nickname: "오너", gender: "female" },
  // 나머지 회원 19: 여 3 + 남 16
  { slot: 2, role: "member", nickname: "여회원1", gender: "female" },
  { slot: 3, role: "member", nickname: "여회원2", gender: "female" },
  { slot: 4, role: "member", nickname: "여회원3", gender: "female" },
  { slot: 5, role: "member", nickname: "남회원01", gender: "male" },
  { slot: 6, role: "member", nickname: "남회원02", gender: "male" },
  { slot: 7, role: "member", nickname: "남회원03", gender: "male" },
  { slot: 8, role: "member", nickname: "남회원04", gender: "male" },
  { slot: 9, role: "member", nickname: "남회원05", gender: "male" },
  { slot: 10, role: "member", nickname: "남회원06", gender: "male" },
  { slot: 11, role: "member", nickname: "남회원07", gender: "male" },
  { slot: 12, role: "member", nickname: "남회원08", gender: "male" },
  { slot: 13, role: "member", nickname: "남회원09", gender: "male" },
  { slot: 14, role: "member", nickname: "남회원10", gender: "male" },
  { slot: 15, role: "member", nickname: "남회원11", gender: "male" },
  { slot: 16, role: "member", nickname: "남회원12", gender: "male" },
  { slot: 17, role: "member", nickname: "남회원13", gender: "male" },
  { slot: 18, role: "member", nickname: "남회원14", gender: "male" },
  { slot: 19, role: "member", nickname: "남회원15", gender: "male" },
  { slot: 20, role: "member", nickname: "남회원16", gender: "male" },
];

export const GUESTS = [
  { slot: 1, nickname: "여게스트1", gender: "female" },
  { slot: 2, nickname: "여게스트2", gender: "female" },
  { slot: 3, nickname: "남게스트1", gender: "male" },
  { slot: 4, nickname: "남게스트2", gender: "male" },
];

export function memberEmail(slot) {
  return `qa-full-club+member-${String(slot).padStart(2, "0")}@${EMAIL_DOMAIN}`;
}

export function guestEmail(slot) {
  return `qa-full-club+guest-${String(slot).padStart(2, "0")}@${EMAIL_DOMAIN}`;
}

// 이벤트 시간: "오늘" 자정 기준 09:00~12:00 UTC, 코트 4개.
// 30분 슬롯 × 6 = 24 슬롯 row (코트당 6슬롯). 24명 / 4명 매치 = 6 매치이므로
// 이론상 한 라운드만 사용해도 모두 한 번씩 들어갈 여유가 있다.
export function buildEventWindow(now = new Date()) {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0),
  );
  const ends = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return {
    eventDate: date.toISOString().slice(0, 10),
    startsAt: date.toISOString(),
    endsAt: ends.toISOString(),
    courtCount: 4,
  };
}

export const EXPECTED_FEMALE_COUNT = 6;
export const EXPECTED_FEMALE_GUEST_COUNT = 2;
export const EXPECTED_MEMBER_COUNT = 20;
export const EXPECTED_GUEST_COUNT = 4;
