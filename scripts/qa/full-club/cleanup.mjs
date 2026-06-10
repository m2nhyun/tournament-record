import { createAdminClient, isQaEmail, section, log } from "./lib.mjs";
import { CLUB_NAME_PREFIX } from "./fixture.mjs";

async function listIds(admin, table, column, value) {
  const { data, error } = await admin.from(table).select("id").eq(column, value);
  if (error) throw new Error(`[cleanup] ${table} list failed: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}

async function deleteByIds(admin, table, ids) {
  if (ids.length === 0) return;
  const { error } = await admin.from(table).delete().in("id", ids);
  if (error) throw new Error(`[cleanup] ${table} delete failed: ${error.message}`);
}

async function deleteByForeignKey(admin, table, column, ids) {
  if (ids.length === 0) return;
  const { error } = await admin.from(table).delete().in(column, ids);
  if (error) throw new Error(`[cleanup] ${table} delete by ${column} failed: ${error.message}`);
}

async function deleteQaClubs(admin) {
  const { data: clubs, error } = await admin
    .from("clubs")
    .select("id,name")
    .like("name", `${CLUB_NAME_PREFIX}%`);
  if (error) throw error;

  for (const club of clubs ?? []) {
    log(`removing club ${club.name} (${club.id})`);

    const eventIds = await listIds(admin, "club_record_events", "club_id", club.id);
    if (eventIds.length > 0) {
      const { data: matchRows, error: mErr } = await admin
        .from("club_record_matches")
        .select("id")
        .in("event_id", eventIds);
      if (mErr) throw new Error(`[cleanup] match list failed: ${mErr.message}`);
      const matchIds = (matchRows ?? []).map((row) => row.id);

      // confirmed 매치는 BEFORE DELETE trigger로 차단되므로 먼저 status를 cancelled로 만든다.
      if (matchIds.length > 0) {
        const { error: updErr } = await admin
          .from("club_record_matches")
          .update({ status: "cancelled" })
          .in("id", matchIds);
        if (updErr) throw new Error(`[cleanup] match cancel failed: ${updErr.message}`);
      }

      await deleteByForeignKey(admin, "club_record_match_results", "match_id", matchIds);
      await deleteByForeignKey(admin, "club_record_match_players", "match_id", matchIds);
      await deleteByIds(admin, "club_record_matches", matchIds);
      await deleteByForeignKey(
        admin,
        "club_record_event_participants",
        "event_id",
        eventIds,
      );
      await deleteByForeignKey(admin, "club_record_event_slots", "event_id", eventIds);
      await deleteByForeignKey(admin, "club_record_guest_invites", "event_id", eventIds);
      await deleteByIds(admin, "club_record_events", eventIds);
    }

    const generalMatchIds = await listIds(admin, "matches", "club_id", club.id);
    if (generalMatchIds.length > 0) {
      await deleteByForeignKey(admin, "match_confirmations", "match_id", generalMatchIds);
      await deleteByIds(admin, "matches", generalMatchIds);
    }

    await admin.from("club_record_guest_profiles").delete().eq("club_id", club.id);
    await admin.from("club_record_members").delete().eq("club_id", club.id);
    await admin.from("club_record_settings").delete().eq("club_id", club.id);
    await admin.from("club_members").delete().eq("club_id", club.id);
    const { error: clubDelErr } = await admin.from("clubs").delete().eq("id", club.id);
    if (clubDelErr) throw new Error(`[cleanup] club delete failed: ${clubDelErr.message}`);
  }
  log(`clubs removed: ${(clubs ?? []).length}`);
}

async function deleteQaAuthUsers(admin) {
  let page = 1;
  const removed = [];
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      const email = user.email ?? "";
      const isAnonQa = !email && user.user_metadata?.qa_full_club === true;
      if (isQaEmail(email) || isAnonQa) {
        const { error: delError } = await admin.auth.admin.deleteUser(user.id);
        if (delError) {
          log(`failed to delete user ${user.id}: ${delError.message}`);
        } else {
          removed.push(user.id);
        }
      }
    }
    if (users.length < 200) break;
    page += 1;
  }
  log(`removed auth users: ${removed.length}`);
}

export async function runCleanup() {
  const admin = createAdminClient();
  section("cleanup: QA 클럽/회원/게스트 제거");
  await deleteQaClubs(admin);
  await deleteQaAuthUsers(admin);
  log("cleanup complete");
}

const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("cleanup.mjs");

if (isDirectRun) {
  runCleanup().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
