-- P1-A: anon role의 광범위한 EXECUTE 권한을 화이트리스트 기반으로 제한.
--
-- 배경:
-- Supabase 기본 schema dump는 public 스키마의 모든 SECURITY DEFINER 함수를
-- anon/authenticated/service_role 세 role 모두에 GRANT한다. 이 프로젝트에서
-- anon이 실제로 호출해야 하는 RPC는 게스트 초대 진입 흐름 4개뿐이며, 나머지
-- 50+ 함수는 anon 호출이 의도된 적이 없다. 함수 내부 가드가 부족한 RPC가
-- 한 개라도 있으면 anon 우회 위험이 생기므로, default-deny + 명시 화이트리스트로
-- 전환한다.
--
-- anon이 호출 가능해야 하는 RPC:
--   1. join_club_by_invite(text, text) — /join/[inviteCode] 회원 가입
--   2. join_club_by_invite_as_guest(text, text) — /join/[inviteCode] 게스트 진입
--   3. verify_club_record_guest_invite_code(text) — club_record 초대코드 검증
--   4. join_club_record_event_guest_by_invite_code(text, text, text, text, club_record_group_code, timestamptz)
--      — /club-record/join/[inviteCode] 게스트 진입
--
-- 모든 클라이언트 비화이트리스트 RPC는 signInAnonymously 사용자(JWT role
-- authenticated, is_anonymous=true)에서 호출되며, anon role JWT-less 호출은
-- 사용하지 않는다.

-- 1. 기존 public 함수의 anon EXECUTE 일괄 회수
revoke execute on all functions in schema public from anon;

-- 2. 향후 추가될 함수가 자동으로 anon에 grant되지 않도록 default privilege 회수
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

-- 3. 화이트리스트 RPC만 anon에 명시적으로 grant
grant execute on function public.join_club_by_invite(text, text) to anon;
grant execute on function public.join_club_by_invite_as_guest(text, text) to anon;
grant execute on function public.verify_club_record_guest_invite_code(text) to anon;
grant execute on function public.join_club_record_event_guest_by_invite_code(
  text,
  text,
  text,
  text,
  public.club_record_group_code,
  timestamp with time zone
) to anon;
