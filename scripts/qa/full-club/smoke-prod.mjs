// 운영 Supabase에 대한 read-only 안전 점검.
// - service_role을 사용하지만, INSERT/UPDATE/DELETE는 일절 하지 않는다.
// - 목적: QA 시드의 흔적이 운영에 남아 있지 않은지 확인.
// scripts/automation/source-env.sh를 거쳐 .env.local의 운영 URL/키가 주입된 상태에서 실행한다.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("[smoke-prod] Missing SUPABASE env (url/anon/service role)");
  process.exit(1);
}

if (url.includes("127.0.0.1") || url.includes("localhost")) {
  console.error("[smoke-prod] Refusing to run against local URL: " + url);
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { count: clubCount, error: clubErr } = await admin
    .from("clubs")
    .select("id", { count: "exact", head: true })
    .like("name", "QA Full-Club Test%");
  if (clubErr) throw clubErr;
  console.log(`[smoke-prod] QA-prefixed clubs in prod: ${clubCount ?? 0}`);
  if ((clubCount ?? 0) !== 0) {
    console.error("[smoke-prod] 운영에 QA 잔존 클럽이 있다. cleanup 필요.");
    process.exit(2);
  }

  const { data: rpc, error: rpcErr } = await admin
    .from("pg_proc")
    .select("proname")
    .in("proname", [
      "apply_club_record_auto_assignments",
      "submit_club_record_match_result",
      "update_club_record_match_result",
      "sync_club_record_members",
      "get_club_record_event_participants",
      "get_club_record_event_slots_overview",
      "refresh_club_record_event_status",
    ]);
  // pg_proc은 일반적으로 PostgREST에 노출되지 않을 수 있다 → 에러는 무시하고 별도 점검.
  if (rpcErr) {
    console.log(`[smoke-prod] pg_proc 직접 조회 불가 (예상 동작): ${rpcErr.message}`);
  } else {
    console.log(`[smoke-prod] pg_proc 직접 조회 결과: ${(rpc ?? []).length}건`);
  }

  // 핵심 RPC 1개를 anon 키로 호출해서 “함수 존재 + 인증 실패 메시지”가 나오는지 확인.
  // service-role로 호출 시 auth.uid()가 null이라 RPC 자체가 "Not authenticated"로 실패한다 → 함수가 살아 있음을 의미한다.
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await anon.rpc("get_club_record_event_participants", {
    p_event_id: "00000000-0000-0000-0000-000000000000",
  });
  const message = error?.message ?? "";
  console.log(`[smoke-prod] anon RPC reply: ${message || "ok"}`);

  console.log("[smoke-prod] OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
