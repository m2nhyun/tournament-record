import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAdminClient,
  createAnonClient,
  createUserClient,
  signInAs,
  clubName,
  memberEmail,
  guestEmail,
  section,
  log,
  assert,
} from "./lib.mjs";
import {
  MEMBERS,
  GUESTS,
  PASSWORD,
  buildEventWindow,
  EXPECTED_MEMBER_COUNT,
  EXPECTED_GUEST_COUNT,
} from "./fixture.mjs";
import { runCleanup } from "./cleanup.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const STATE_FILE = join(HERE, ".qa-state.json");

function buildInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

async function createOrFindUser(admin, email, password, metadata) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (!error) return created.user;

  if (!String(error.message).toLowerCase().includes("already")) {
    throw new Error(`createUser failed for ${email}: ${error.message}`);
  }

  // Already exists; locate via listUsers.
  let page = 1;
  while (true) {
    const { data, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listError) throw listError;
    const found = (data?.users ?? []).find((u) => u.email === email);
    if (found) return found;
    if ((data?.users ?? []).length < 200) break;
    page += 1;
  }
  throw new Error(`could not locate existing user ${email}`);
}

async function upsertUserProfile(admin, userId, displayName, gender) {
  const { error } = await admin.from("user_profiles").upsert(
    {
      user_id: userId,
      display_name: displayName,
      gender,
      profile_completed: true,
      auth_provider: "email",
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`user_profiles upsert failed: ${error.message}`);
}

async function createMembers(admin) {
  section("members: auth user + user_profile 생성");
  const created = [];
  for (const member of MEMBERS) {
    const email = memberEmail(member.slot);
    const user = await createOrFindUser(admin, email, PASSWORD, {
      qa_full_club: true,
      nickname: member.nickname,
    });
    await upsertUserProfile(admin, user.id, member.nickname, member.gender);
    created.push({ ...member, email, userId: user.id });
  }
  log(`members ready: ${created.length}`);
  assert(created.length === EXPECTED_MEMBER_COUNT, "member count mismatch");
  return created;
}

async function createGuestAuthUsers(admin) {
  section("guests: anonymous-ish auth user + identifying metadata 생성");
  // Supabase signInAnonymously()를 service-role 측에서 직접 만들 수는 없으나,
  // 이 시드의 목적은 식별 가능한 인증 사용자에 게스트 프로필을 매다는 것이므로,
  // 도메인 분리된 이메일 사용자를 생성하고 metadata로 qa_full_club을 박는다.
  // 권한 시나리오에서는 별도 anonymous sign-in을 같은 client에서 실행한다.
  const created = [];
  for (const guest of GUESTS) {
    const email = guestEmail(guest.slot);
    const user = await createOrFindUser(admin, email, PASSWORD, {
      qa_full_club: true,
      qa_guest: true,
      nickname: guest.nickname,
    });
    created.push({ ...guest, email, userId: user.id });
  }
  log(`guest auth users ready: ${created.length}`);
  assert(created.length === EXPECTED_GUEST_COUNT, "guest count mismatch");
  return created;
}

async function createClubAndMembers(admin, members) {
  section("club + club_members 생성");
  const owner = members.find((m) => m.role === "owner");
  assert(owner, "owner missing");

  const inviteCode = buildInviteCode();
  const { data: club, error: clubError } = await admin
    .from("clubs")
    .insert({
      name: clubName(),
      invite_code: inviteCode,
      created_by: owner.userId,
    })
    .select("id")
    .single();
  if (clubError) throw new Error(`club insert failed: ${clubError.message}`);

  const memberRows = members.map((m) => ({
    club_id: club.id,
    user_id: m.userId,
    role: m.role,
    nickname: m.nickname,
    is_active: true,
  }));
  const { error: memberError } = await admin.from("club_members").insert(memberRows);
  if (memberError) throw new Error(`club_members insert failed: ${memberError.message}`);

  log(`club ${club.id} created (invite=${inviteCode}), ${memberRows.length} club_members`);
  return { clubId: club.id, inviteCode, ownerUserId: owner.userId };
}

async function syncClubRecordRanking(ownerAccessToken, clubId) {
  section("club_record_members 자동 동기화 (sync_club_record_members)");
  const owner = createUserClient(ownerAccessToken);
  const { data, error } = await owner.rpc("sync_club_record_members", {
    p_club_id: clubId,
  });
  if (error) throw new Error(`sync_club_record_members failed: ${error.message}`);
  log(`inserted club_record_members rows: ${data}`);
}

function buildSlotInserts(eventId, startsAtIso, endsAtIso, courtCount) {
  const SLOT_DURATION_MS = 30 * 60 * 1000;
  const start = new Date(startsAtIso).getTime();
  const end = new Date(endsAtIso).getTime();
  const slotCount = Math.round((end - start) / SLOT_DURATION_MS);
  const rows = [];
  for (let order = 1; order <= slotCount; order += 1) {
    const slotStart = new Date(start + SLOT_DURATION_MS * (order - 1));
    const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MS);
    for (let court = 1; court <= courtCount; court += 1) {
      rows.push({
        event_id: eventId,
        court_number: court,
        slot_order: order,
        starts_at: slotStart.toISOString(),
        ends_at: slotEnd.toISOString(),
      });
    }
  }
  return rows;
}

async function createEventAndSlots(admin, clubId, ownerUserId) {
  section("club_record_events + slots 생성");
  const window = buildEventWindow();
  const { data: event, error } = await admin
    .from("club_record_events")
    .insert({
      club_id: clubId,
      title: "QA Full-Club Scenario",
      event_date: window.eventDate,
      starts_at: window.startsAt,
      ends_at: window.endsAt,
      court_count: window.courtCount,
      status: "draft",
      created_by: ownerUserId,
      updated_by: ownerUserId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`event insert failed: ${error.message}`);

  const slots = buildSlotInserts(
    event.id,
    window.startsAt,
    window.endsAt,
    window.courtCount,
  );
  const { error: slotError } = await admin
    .from("club_record_event_slots")
    .insert(slots);
  if (slotError) throw new Error(`slots insert failed: ${slotError.message}`);
  log(`event ${event.id} created with ${slots.length} slots`);
  return { eventId: event.id, window };
}

async function addParticipants(admin, clubId, eventId, members, guests, ownerUserId) {
  section("event_participants 등록 (회원 20 + 게스트 4)");

  const { data: clubMemberRows, error: cmError } = await admin
    .from("club_members")
    .select("id,user_id")
    .eq("club_id", clubId);
  if (cmError) throw cmError;
  const clubMemberIdByUser = new Map(
    (clubMemberRows ?? []).map((row) => [row.user_id, row.id]),
  );

  const memberParticipantRows = members.map((m) => ({
    event_id: eventId,
    participant_type: "member",
    club_member_id: clubMemberIdByUser.get(m.userId),
    arrival_time: null,
    attendance_status: "registered",
    added_by: ownerUserId,
  }));
  const { error: mErr } = await admin
    .from("club_record_event_participants")
    .insert(memberParticipantRows);
  if (mErr) throw new Error(`member participants insert failed: ${mErr.message}`);

  // 게스트는 guest_profiles를 먼저 만들고 event_participants로 연결.
  const guestProfileRows = guests.map((g) => ({
    club_id: clubId,
    guest_user_id: g.userId,
    display_name: g.nickname,
    gender: g.gender,
    career_text: null,
    group_code: "C",
  }));
  const { data: guestProfiles, error: gpErr } = await admin
    .from("club_record_guest_profiles")
    .insert(guestProfileRows)
    .select("id,guest_user_id");
  if (gpErr) throw new Error(`guest_profiles insert failed: ${gpErr.message}`);

  const guestParticipantRows = guestProfiles.map((gp) => ({
    event_id: eventId,
    participant_type: "guest",
    guest_profile_id: gp.id,
    arrival_time: null,
    attendance_status: "registered",
    added_by: ownerUserId,
  }));
  const { error: gErr } = await admin
    .from("club_record_event_participants")
    .insert(guestParticipantRows);
  if (gErr) throw new Error(`guest participants insert failed: ${gErr.message}`);

  log(`participants inserted: members=${memberParticipantRows.length}, guests=${guestProfiles.length}`);
}

async function refreshState(ownerAccessToken, eventId) {
  const owner = createUserClient(ownerAccessToken);
  const { error } = await owner.rpc("refresh_club_record_event_status", {
    p_event_id: eventId,
  });
  if (error) throw new Error(`refresh status failed: ${error.message}`);
}

export async function runSeed({ cleanFirst = true } = {}) {
  if (cleanFirst) {
    await runCleanup();
  }

  const admin = createAdminClient();
  const members = await createMembers(admin);
  const guests = await createGuestAuthUsers(admin);
  const { clubId, inviteCode, ownerUserId } = await createClubAndMembers(admin, members);
  const owner = members.find((m) => m.role === "owner");
  const ownerSignIn = await signInAs(owner.email);
  await syncClubRecordRanking(ownerSignIn.accessToken, clubId);
  const { eventId, window } = await createEventAndSlots(admin, clubId, ownerUserId);
  await addParticipants(admin, clubId, eventId, members, guests, ownerUserId);
  await refreshState(ownerSignIn.accessToken, eventId);

  const state = {
    clubId,
    inviteCode,
    eventId,
    ownerEmail: owner.email,
    ownerUserId,
    members,
    guests,
    eventWindow: window,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  section("seed 완료");
  log(`state written to ${STATE_FILE}`);
}

const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("seed.mjs");

if (isDirectRun) {
  runSeed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
