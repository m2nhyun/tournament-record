/**
 * Full-club end-to-end 시나리오.
 *
 * - seed.mjs가 만든 `.qa-state.json`을 읽어 클럽/이벤트/회원 정보를 가져온다.
 * - `planClubRecordAutoAssignments` 클라이언트 함수와 Supabase RPC를 함께 호출해 자동 편성 → 결과 입력 → 랭킹 갱신까지 검증한다.
 * - 게스트/회원 권한 차단, 점수 유효성, 재편성 차단 등 엣지케이스 포함.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import {
  planClubRecordAutoAssignments,
  computeWomenMatchTarget,
} from "@/features/club-record/utils/auto-assignment";
import { parseClubRecordScoreText } from "@/features/club-record/utils/score";
import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type {
  ClubRecordEventSlotOverview,
  ClubRecordSlotMatchSummary,
  ClubRecordSlotPlayer,
} from "@/features/club-record/types/slot";
import type {
  ClubRecordAssignmentMode,
  ClubRecordMatchStatus,
} from "@/features/club-record/types/match";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const STATE_PATH = join(HERE, ".qa-state.json");
const PASSWORD = "qa-full-club-pass!1";

type SeedMember = {
  slot: number;
  role: "owner" | "member";
  nickname: string;
  gender: "female" | "male";
  email: string;
  userId: string;
};

type SeedGuest = {
  slot: number;
  nickname: string;
  gender: "female" | "male";
  email: string;
  userId: string;
};

type SeedState = {
  clubId: string;
  inviteCode: string;
  eventId: string;
  ownerEmail: string;
  ownerUserId: string;
  members: SeedMember[];
  guests: SeedGuest[];
  eventWindow: {
    eventDate: string;
    startsAt: string;
    endsAt: string;
    courtCount: number;
  };
};

type ParticipantRow = {
  id: string;
  event_id: string;
  participant_type: ClubRecordEventParticipant["participantType"];
  club_member_id: string | null;
  guest_profile_id: string | null;
  display_name: string | null;
  arrival_time: string | null;
  attendance_status: ClubRecordEventParticipant["attendanceStatus"];
  group_code: ClubRecordEventParticipant["groupCode"];
  ranking_position: number | null;
  gender: string | null;
};

type SlotOverviewRow = {
  id: string;
  event_id: string;
  court_number: number;
  slot_order: number;
  starts_at: string;
  ends_at: string;
  status: ClubRecordEventSlotOverview["status"];
  is_locked: boolean;
  match_id: string | null;
  match_status: ClubRecordMatchStatus | null;
  assignment_mode: ClubRecordAssignmentMode | null;
  is_manual: boolean | null;
  confirmed_at: string | null;
  score_text: string | null;
  player_participant_id: string | null;
  player_display_name: string | null;
  player_side: number | null;
  player_position: number | null;
};

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[e2e] missing env: ${name}`);
  }
  return value;
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function userClientFor(email: string) {
  const auth = anonClient();
  const { data, error } = await auth.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) {
    throw new Error(`[e2e] sign-in failed for ${email}: ${error?.message}`);
  }
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    },
  });
}

function toParticipants(rows: ParticipantRow[]): ClubRecordEventParticipant[] {
  return rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    participantType: row.participant_type,
    clubMemberId: row.club_member_id,
    guestProfileId: row.guest_profile_id,
    displayName: row.display_name ?? "이름 없음",
    arrivalTime: row.arrival_time,
    attendanceStatus: row.attendance_status,
    groupCode: row.group_code,
    rankingPosition: row.ranking_position,
    gender:
      row.gender === "male" || row.gender === "female" || row.gender === "unspecified"
        ? row.gender
        : null,
  }));
}

function toSlots(rows: SlotOverviewRow[]): ClubRecordEventSlotOverview[] {
  const byId = new Map<string, ClubRecordEventSlotOverview>();
  for (const row of rows) {
    let slot = byId.get(row.id);
    if (!slot) {
      const match: ClubRecordSlotMatchSummary | null = row.match_id
        ? {
            id: row.match_id,
            status: (row.match_status ?? "pending_result") as ClubRecordMatchStatus,
            assignmentMode: (row.assignment_mode ?? "auto") as ClubRecordAssignmentMode,
            isManual: Boolean(row.is_manual),
            confirmedAt: row.confirmed_at,
            scoreText: row.score_text,
            players: [],
          }
        : null;
      slot = {
        id: row.id,
        eventId: row.event_id,
        courtNumber: row.court_number,
        slotOrder: row.slot_order,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        isLocked: row.is_locked,
        match,
      };
      byId.set(row.id, slot);
    }
    if (slot.match && row.player_participant_id) {
      const player: ClubRecordSlotPlayer = {
        participantId: row.player_participant_id,
        displayName: row.player_display_name ?? "이름 없음",
        side: (Number(row.player_side ?? 1) === 2 ? 2 : 1) as 1 | 2,
        position: (Number(row.player_position ?? 1) === 2 ? 2 : 1) as 1 | 2,
      };
      slot.match.players.push(player);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const t = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (t !== 0) return t;
    return a.courtNumber - b.courtNumber;
  });
}

async function fetchParticipants(
  client: SupabaseClient,
  eventId: string,
): Promise<ClubRecordEventParticipant[]> {
  const { data, error } = await client.rpc("get_club_record_event_participants", {
    p_event_id: eventId,
  });
  if (error) throw error;
  return toParticipants((data ?? []) as ParticipantRow[]);
}

async function fetchSlots(
  client: SupabaseClient,
  eventId: string,
): Promise<ClubRecordEventSlotOverview[]> {
  const { data, error } = await client.rpc("get_club_record_event_slots_overview", {
    p_event_id: eventId,
  });
  if (error) throw error;
  return toSlots((data ?? []) as SlotOverviewRow[]);
}

const state: SeedState = JSON.parse(readFileSync(STATE_PATH, "utf8"));

describe("full-club e2e — 클럽 24명 풀 시나리오", () => {
  let ownerClient: SupabaseClient;
  let participants: ClubRecordEventParticipant[] = [];
  let slots: ClubRecordEventSlotOverview[] = [];
  let plannedMatches: ReturnType<typeof planClubRecordAutoAssignments> = [];

  beforeAll(async () => {
    ownerClient = await userClientFor(state.ownerEmail);
  });

  it("participants RPC가 회원 20 + 게스트 4를 반환하고 성별 분포가 기대치와 일치", async () => {
    participants = await fetchParticipants(ownerClient, state.eventId);
    expect(participants).toHaveLength(24);
    expect(participants.filter((p) => p.participantType === "member")).toHaveLength(20);
    expect(participants.filter((p) => p.participantType === "guest")).toHaveLength(4);
    expect(participants.filter((p) => p.gender === "female")).toHaveLength(6);
    expect(
      participants.filter((p) => p.participantType === "guest" && p.gender === "female"),
    ).toHaveLength(2);
    expect(
      participants.filter(
        (p) => p.participantType === "member" && typeof p.rankingPosition !== "number",
      ),
    ).toHaveLength(0);
    expect(
      participants.filter(
        (p) =>
          p.participantType === "member" &&
          p.groupCode !== "A" &&
          p.groupCode !== "B" &&
          p.groupCode !== "C",
      ),
    ).toHaveLength(0);
  });

  it("computeWomenMatchTarget(여6) === 2", () => {
    expect(computeWomenMatchTarget(participants)).toBe(2);
  });

  it("planClubRecordAutoAssignments가 24명 분포에 대해 6개 이상의 quartet 계획을 만든다", async () => {
    slots = await fetchSlots(ownerClient, state.eventId);
    plannedMatches = planClubRecordAutoAssignments(participants, slots, {
      candidateWindowSize: 24,
      maxSharedMatchesPerDay: 2,
    });
    expect(plannedMatches.length).toBeGreaterThanOrEqual(6);
    for (const plan of plannedMatches) {
      expect(plan.players).toHaveLength(4);
      const sides = new Set(plan.players.map((p) => p.side));
      expect(sides).toEqual(new Set([1, 2]));
    }
  });

  it("apply_club_record_auto_assignments RPC가 계획을 그대로 DB에 반영한다", async () => {
    const { data, error } = await ownerClient.rpc("apply_club_record_auto_assignments", {
      p_event_id: state.eventId,
      p_plans: plannedMatches,
    });
    expect(error?.message).toBeUndefined();
    expect(data).toBe(plannedMatches.length);
  });

  it("자동 편성 후 all-female quartet이 목표(2)만큼 등장한다", async () => {
    const afterSlots = await fetchSlots(ownerClient, state.eventId);
    const genderById = new Map<string, ClubRecordEventParticipant["gender"]>();
    for (const participant of participants) {
      genderById.set(participant.id, participant.gender);
    }
    const allFemaleMatches = afterSlots.filter((slot) =>
      slot.match && slot.match.players.length === 4
        ? slot.match.players.every((p) => genderById.get(p.participantId) === "female")
        : false,
    );
    expect(allFemaleMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("submit_club_record_match_result: 매치 참가 회원이 결과 입력 → confirmed", async () => {
    const afterSlots = await fetchSlots(ownerClient, state.eventId);
    const targetMatch = afterSlots.find(
      (s) =>
        s.match?.status === "pending_result" &&
        s.match.players.every((p) => {
          const part = participants.find((pp) => pp.id === p.participantId);
          return part?.participantType === "member";
        }),
    );
    expect(targetMatch).toBeDefined();

    const memberPlayer = targetMatch!.match!.players[0]!;
    const memberParticipant = participants.find((p) => p.id === memberPlayer.participantId)!;
    expect(memberParticipant.clubMemberId).toBeTruthy();

    const admin = adminClient();
    const { data: memberRow, error } = await admin
      .from("club_members")
      .select("id,user_id")
      .eq("id", memberParticipant.clubMemberId)
      .single();
    expect(error?.message).toBeUndefined();
    const memberStateRow = state.members.find((m) => m.userId === memberRow!.user_id);
    expect(memberStateRow).toBeDefined();

    const memberClient = await userClientFor(memberStateRow!.email);
    const parsed = parseClubRecordScoreText("6-4");
    if (parsed.isDraw) throw new Error("setup: expected non-draw score");

    const { data: submitData, error: submitError } = await memberClient.rpc(
      "submit_club_record_match_result",
      {
        p_match_id: targetMatch!.match!.id,
        p_score_text: parsed.normalizedScoreText,
        p_is_draw: parsed.isDraw,
        p_winning_side: parsed.winningSide,
        p_losing_side: parsed.losingSide,
      },
    );
    expect(submitError?.message).toBeUndefined();
    expect(Array.isArray(submitData) ? submitData.length : 0).toBe(1);

    const { data: matchRow } = await admin
      .from("club_record_matches")
      .select("status,confirmed_at")
      .eq("id", targetMatch!.match!.id)
      .single();
    expect(matchRow?.status).toBe("confirmed");
    expect(matchRow?.confirmed_at).toBeTruthy();
  });

  it("update_club_record_match_result: owner가 직접 결과 갱신 (무승부 포함)", async () => {
    const afterSlots = await fetchSlots(ownerClient, state.eventId);
    const pending = afterSlots.filter((s) => s.match?.status === "pending_result");
    expect(pending.length).toBeGreaterThan(0);
    const ownerMatch = pending[0]!;

    const draw = parseClubRecordScoreText("6-6");
    expect(draw.isDraw).toBe(true);
    const { error } = await ownerClient.rpc("update_club_record_match_result", {
      p_match_id: ownerMatch.match!.id,
      p_score_text: draw.normalizedScoreText,
      p_is_draw: draw.isDraw,
      p_winning_side: null,
      p_losing_side: null,
    });
    expect(error?.message).toBeUndefined();

    const admin = adminClient();
    const { data: matchRow } = await admin
      .from("club_record_matches")
      .select("status")
      .eq("id", ownerMatch.match!.id)
      .single();
    expect(matchRow?.status).toBe("confirmed");

    const { data: resultRow } = await admin
      .from("club_record_match_results")
      .select("is_draw,score_text,winning_side,losing_side")
      .eq("match_id", ownerMatch.match!.id)
      .single();
    expect(resultRow?.is_draw).toBe(true);
    expect(resultRow?.score_text).toBe("6-6");
    expect(resultRow?.winning_side).toBeNull();
    expect(resultRow?.losing_side).toBeNull();
  });

  it("이미 confirmed 자동매치가 있으면 apply_club_record_auto_assignments 재호출이 차단된다", async () => {
    const { error } = await ownerClient.rpc("apply_club_record_auto_assignments", {
      p_event_id: state.eventId,
      p_plans: plannedMatches,
    });
    expect(error?.message ?? "").toMatch(/재편성할 수 없습니다|이미 결과가 확정/);
  });

  it("회원이 자신이 참가하지 않은 매치에 결과를 제출하면 거절된다", async () => {
    const afterSlots = await fetchSlots(ownerClient, state.eventId);
    const pending = afterSlots.find((s) => s.match?.status === "pending_result");
    expect(pending).toBeDefined();

    const playerParticipantIds = new Set(
      pending!.match!.players.map((p) => p.participantId),
    );
    const outsider = participants.find(
      (p) =>
        p.participantType === "member" &&
        !playerParticipantIds.has(p.id) &&
        typeof p.clubMemberId === "string",
    );
    expect(outsider).toBeDefined();

    const admin = adminClient();
    const { data: memberRow } = await admin
      .from("club_members")
      .select("user_id")
      .eq("id", outsider!.clubMemberId!)
      .single();
    const memberSeed = state.members.find((m) => m.userId === memberRow!.user_id);
    expect(memberSeed).toBeDefined();

    const outsiderClient = await userClientFor(memberSeed!.email);
    const { error } = await outsiderClient.rpc("submit_club_record_match_result", {
      p_match_id: pending!.match!.id,
      p_score_text: "6-3",
      p_is_draw: false,
      p_winning_side: 1,
      p_losing_side: 2,
    });
    expect(error?.message ?? "").toMatch(/권한이 없습니다|참가자 정보를 찾을 수 없습니다/);
  });

  it("비회원 사용자(게스트 인증)는 club_record_event_participants를 직접 insert할 수 없다 (RLS)", async () => {
    // 시드된 게스트 이메일 사용자는 club_members에 들어 있지 않으므로 RLS 차단 대상.
    // (운영에서는 anonymous 세션도 같은 정책으로 차단됨.)
    const guest = state.guests[0]!;
    const guestClient = await userClientFor(guest.email);
    const memberParticipant = participants.find((p) => p.participantType === "member")!;
    const { error } = await guestClient
      .from("club_record_event_participants")
      .insert({
        event_id: state.eventId,
        participant_type: "member",
        club_member_id: memberParticipant.clubMemberId,
        added_by: guest.userId,
      });
    expect(error?.message ?? "").toMatch(
      /(violates row-level security|permission denied|policy|not authenticated|같은 클럽)/i,
    );
  });

  it("club_record_members.match_count이 결과 입력 후 갱신된다", async () => {
    const admin = adminClient();
    const { data } = await admin
      .from("club_record_members")
      .select("match_count")
      .eq("club_id", state.clubId);
    const total = (data ?? []).reduce((sum, row) => sum + Number(row.match_count ?? 0), 0);
    expect(total).toBeGreaterThan(0);
  });

  it("event status가 in_progress / open / completed 로 자동 전환된다", async () => {
    const { error } = await ownerClient.rpc("refresh_club_record_event_status", {
      p_event_id: state.eventId,
    });
    expect(error?.message).toBeUndefined();
    const admin = adminClient();
    const { data } = await admin
      .from("club_record_events")
      .select("status")
      .eq("id", state.eventId)
      .single();
    expect(["in_progress", "completed", "open"]).toContain(data?.status);
  });

  it("parseClubRecordScoreText: 유효 패턴 통과, 비정상 패턴 reject", () => {
    expect(parseClubRecordScoreText("6-4")).toMatchObject({
      isDraw: false,
      winningSide: 1,
      losingSide: 2,
    });
    expect(parseClubRecordScoreText("4-6")).toMatchObject({
      isDraw: false,
      winningSide: 2,
      losingSide: 1,
    });
    expect(parseClubRecordScoreText("6-6")).toMatchObject({ isDraw: true });
    expect(() => parseClubRecordScoreText("abc")).toThrow();
    expect(() => parseClubRecordScoreText("-1-3")).toThrow();
  });
});
