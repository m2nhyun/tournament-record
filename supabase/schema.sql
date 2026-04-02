


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."club_member_role" AS ENUM (
    'owner',
    'manager',
    'member',
    'guest'
);


ALTER TYPE "public"."club_member_role" OWNER TO "postgres";


CREATE TYPE "public"."match_confirmation_decision" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."match_confirmation_decision" OWNER TO "postgres";


CREATE TYPE "public"."match_schedule_format" AS ENUM (
    'men_doubles',
    'women_doubles',
    'open_doubles'
);


ALTER TYPE "public"."match_schedule_format" OWNER TO "postgres";


CREATE TYPE "public"."match_schedule_join_policy" AS ENUM (
    'instant',
    'approval_required'
);


ALTER TYPE "public"."match_schedule_join_policy" OWNER TO "postgres";


CREATE TYPE "public"."match_schedule_request_status" AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'cancelled_by_user'
);


ALTER TYPE "public"."match_schedule_request_status" OWNER TO "postgres";


CREATE TYPE "public"."match_schedule_status" AS ENUM (
    'open',
    'full',
    'cancelled',
    'reviewing'
);


ALTER TYPE "public"."match_schedule_status" OWNER TO "postgres";


CREATE TYPE "public"."match_status" AS ENUM (
    'draft',
    'submitted',
    'confirmed',
    'disputed'
);


ALTER TYPE "public"."match_status" OWNER TO "postgres";


CREATE TYPE "public"."match_type" AS ENUM (
    'singles',
    'doubles'
);


ALTER TYPE "public"."match_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_schedule record;
  v_participant_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.id, ms.club_id, ms.capacity, ms.status, ms.host_member_id
    into v_schedule
  from public.match_schedules ms
  where ms.id = p_schedule_id
  for update;

  if v_schedule.id is null then
    raise exception '일정을 찾을 수 없습니다.';
  end if;

  if not (
    public.is_club_admin(v_schedule.club_id)
    or exists (
      select 1
      from public.club_members cm
      where cm.id = v_schedule.host_member_id
        and cm.user_id = v_user_id
        and cm.is_active = true
    )
  ) then
    raise exception '신청을 검토할 권한이 없습니다.';
  end if;

  if v_schedule.status = 'cancelled' then
    raise exception '취소된 일정입니다.';
  end if;

  if not exists (
    select 1
    from public.match_schedule_requests msr
    where msr.schedule_id = p_schedule_id
      and msr.club_member_id = p_club_member_id
      and msr.status = 'pending'
  ) then
    raise exception '대기 중인 신청이 없습니다.';
  end if;

  select count(*)
    into v_participant_count
  from public.match_schedule_participants
  where schedule_id = p_schedule_id;

  if v_participant_count >= v_schedule.capacity then
    raise exception '정원이 모두 찼습니다.';
  end if;

  insert into public.match_schedule_participants (
    schedule_id,
    club_member_id,
    joined_by
  )
  values (
    p_schedule_id,
    p_club_member_id,
    v_user_id
  )
  on conflict (schedule_id, club_member_id) do nothing;

  update public.match_schedule_requests
  set status = 'accepted',
      updated_at = now()
  where schedule_id = p_schedule_id
    and club_member_id = p_club_member_id;

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;


ALTER FUNCTION "public"."accept_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_create_match_schedule"("p_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.role in ('owner', 'manager', 'member')
  );
$$;


ALTER FUNCTION "public"."can_create_match_schedule"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_match"("p_club_id" "uuid", "p_created_by" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'manager')
  )
  or (auth.uid() = p_created_by);
$$;


ALTER FUNCTION "public"."can_manage_match"("p_club_id" "uuid", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_match_schedule_request"("p_schedule_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.match_schedule_requests
  set status = 'cancelled_by_user',
      updated_at = now()
  where schedule_id = p_schedule_id
    and requested_by = v_user_id
    and status = 'pending';

  if not found then
    raise exception '취소할 신청이 없습니다.';
  end if;

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;


ALTER FUNCTION "public"."cancel_match_schedule_request"("p_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_match_schedule"("p_club_id" "uuid", "p_format" "public"."match_schedule_format", "p_scheduled_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_court_fee" integer DEFAULT 0, "p_ball_fee" integer DEFAULT 0, "p_capacity" integer DEFAULT 4, "p_notes" "text" DEFAULT ''::"text", "p_include_host" boolean DEFAULT true, "p_join_policy" "public"."match_schedule_join_policy" DEFAULT 'instant'::"public"."match_schedule_join_policy") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_host_member_id uuid;
  v_schedule_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select cm.id
    into v_host_member_id
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.user_id = v_user_id
    and cm.is_active = true
  limit 1;

  if v_host_member_id is null then
    raise exception '클럽 멤버만 일정을 생성할 수 있습니다.';
  end if;

  if not public.can_create_match_schedule(p_club_id) then
    raise exception '게스트는 일정을 생성할 수 없습니다.';
  end if;

  if p_scheduled_at <= now() then
    raise exception '일정은 현재 이후 시간으로 등록해주세요.';
  end if;

  if p_ends_at <= p_scheduled_at then
    raise exception '종료 시간은 시작 시간보다 뒤여야 합니다.';
  end if;

  insert into public.match_schedules (
    club_id,
    host_member_id,
    created_by,
    format,
    status,
    join_policy,
    scheduled_at,
    ends_at,
    location,
    court_fee,
    ball_fee,
    capacity,
    notes
  )
  values (
    p_club_id,
    v_host_member_id,
    v_user_id,
    p_format,
    'open',
    coalesce(p_join_policy, 'instant'),
    p_scheduled_at,
    p_ends_at,
    trim(p_location),
    greatest(0, coalesce(p_court_fee, 0)),
    greatest(0, coalesce(p_ball_fee, 0)),
    greatest(1, least(8, coalesce(p_capacity, 4))),
    left(coalesce(trim(p_notes), ''), 240)
  )
  returning id
  into v_schedule_id;

  if coalesce(p_include_host, true) then
    insert into public.match_schedule_participants (schedule_id, club_member_id, joined_by)
    values (v_schedule_id, v_host_member_id, v_user_id);
  end if;

  perform public.refresh_match_schedule_status(v_schedule_id);

  return v_schedule_id;
end;
$$;


ALTER FUNCTION "public"."create_match_schedule"("p_club_id" "uuid", "p_format" "public"."match_schedule_format", "p_scheduled_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_court_fee" integer, "p_ball_fee" integer, "p_capacity" integer, "p_notes" "text", "p_include_host" boolean, "p_join_policy" "public"."match_schedule_join_policy") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_code_unique"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_code text;
  v_exists boolean;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    select exists(select 1 from public.clubs c where c.invite_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;

  return v_code;
end;
$$;


ALTER FUNCTION "public"."generate_invite_code_unique"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_admin"("target_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(
    select 1
    from public.club_members cm
    where cm.club_id = target_club_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.role in ('owner', 'manager')
  );
$$;


ALTER FUNCTION "public"."is_club_admin"("target_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_member"("target_club_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(
    select 1
    from public.club_members cm
    where cm.club_id = target_club_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
  );
$$;


ALTER FUNCTION "public"."is_club_member"("target_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_club_by_invite"("p_invite_code" "text", "p_nickname" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_club_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id
    into v_club_id
  from public.clubs
  where invite_code = upper(trim(p_invite_code))
    and invite_expires_at > now()
  limit 1;

  if v_club_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.club_members (club_id, user_id, role, nickname, is_active, left_at)
  values (v_club_id, v_user_id, 'member', trim(p_nickname), true, null)
  on conflict (club_id, user_id)
  do update
    set nickname = excluded.nickname,
        is_active = true,
        left_at = null,
        role = case
          when public.club_members.role in ('owner', 'manager', 'member') then public.club_members.role
          else 'member'
        end;

  return v_club_id;
end;
$$;


ALTER FUNCTION "public"."join_club_by_invite"("p_invite_code" "text", "p_nickname" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_club_by_invite_as_guest"("p_invite_code" "text", "p_nickname" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_club_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id
    into v_club_id
  from public.clubs
  where invite_code = upper(trim(p_invite_code))
    and invite_expires_at > now()
  limit 1;

  if v_club_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.club_members (club_id, user_id, role, nickname, is_active, left_at)
  values (v_club_id, v_user_id, 'guest', trim(p_nickname), true, null)
  on conflict (club_id, user_id)
  do update
    set nickname = excluded.nickname,
        is_active = true,
        left_at = null,
        role = case
          when public.club_members.role in ('owner', 'manager', 'member') then public.club_members.role
          else 'guest'
        end;

  return v_club_id;
end;
$$;


ALTER FUNCTION "public"."join_club_by_invite_as_guest"("p_invite_code" "text", "p_nickname" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_match_schedule"("p_schedule_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_schedule record;
  v_participant_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.id, ms.club_id, ms.capacity, ms.status
    into v_schedule
  from public.match_schedules ms
  where ms.id = p_schedule_id
  for update;

  if v_schedule.id is null then
    raise exception '일정을 찾을 수 없습니다.';
  end if;

  if v_schedule.status = 'cancelled' then
    raise exception '취소된 일정에는 참가할 수 없습니다.';
  end if;

  select cm.id
    into v_member_id
  from public.club_members cm
  where cm.club_id = v_schedule.club_id
    and cm.user_id = v_user_id
    and cm.is_active = true
  limit 1;

  if v_member_id is null then
    raise exception '클럽 멤버만 일정에 참가할 수 있습니다.';
  end if;

  if exists (
    select 1
    from public.match_schedule_participants msp
    where msp.schedule_id = p_schedule_id
      and msp.club_member_id = v_member_id
  ) then
    return p_schedule_id;
  end if;

  select count(*)
    into v_participant_count
  from public.match_schedule_participants
  where schedule_id = p_schedule_id;

  if v_participant_count >= v_schedule.capacity then
    raise exception '정원이 모두 찼습니다.';
  end if;

  insert into public.match_schedule_participants (
    schedule_id,
    club_member_id,
    joined_by
  )
  values (
    p_schedule_id,
    v_member_id,
    v_user_id
  );

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;


ALTER FUNCTION "public"."join_match_schedule"("p_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_match_schedule"("p_schedule_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_host_member_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.host_member_id, cm.id
    into v_host_member_id, v_member_id
  from public.match_schedules ms
  join public.club_members cm
    on cm.club_id = ms.club_id
  where ms.id = p_schedule_id
    and cm.user_id = v_user_id
    and cm.is_active = true
  limit 1;

  if v_member_id is null then
    raise exception '참가 중인 일정이 아닙니다.';
  end if;

  if v_member_id = v_host_member_id then
    raise exception '개설자는 일정을 나갈 수 없습니다.';
  end if;

  delete from public.match_schedule_participants
  where schedule_id = p_schedule_id
    and club_member_id = v_member_id;

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;


ALTER FUNCTION "public"."leave_match_schedule"("p_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_match_schedule_status"("p_schedule_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_capacity smallint;
  v_status public.match_schedule_status;
  v_join_policy public.match_schedule_join_policy;
  v_participant_count integer;
  v_pending_request_count integer;
begin
  select capacity, status, join_policy
    into v_capacity, v_status, v_join_policy
  from public.match_schedules
  where id = p_schedule_id;

  if v_capacity is null then
    return;
  end if;

  if v_status = 'cancelled' then
    return;
  end if;

  select count(*)
    into v_participant_count
  from public.match_schedule_participants
  where schedule_id = p_schedule_id;

  select count(*)
    into v_pending_request_count
  from public.match_schedule_requests
  where schedule_id = p_schedule_id
    and status = 'pending';

  update public.match_schedules
  set status = case
    when v_participant_count >= v_capacity then 'full'
    when v_join_policy = 'approval_required' and v_pending_request_count > 0 then 'reviewing'
    else 'open'
  end
  where id = p_schedule_id;
end;
$$;


ALTER FUNCTION "public"."refresh_match_schedule_status"("p_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."regenerate_club_invite_code"("p_club_id" "uuid", "p_days_valid" integer DEFAULT 30) RETURNS TABLE("invite_code" "text", "invite_expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_days int := greatest(1, least(90, coalesce(p_days_valid, 30)));
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = v_user_id
      and cm.role = 'owner'
  ) then
    raise exception 'Only owner can regenerate invite code';
  end if;

  update public.clubs c
  set
    invite_code = public.generate_invite_code_unique(),
    invite_expires_at = now() + make_interval(days => v_days)
  where c.id = p_club_id
  returning c.invite_code, c.invite_expires_at
  into invite_code, invite_expires_at;

  if invite_code is null then
    raise exception 'Club not found';
  end if;

  return next;
end;
$$;


ALTER FUNCTION "public"."regenerate_club_invite_code"("p_club_id" "uuid", "p_days_valid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_club_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.club_id
    into v_club_id
  from public.match_schedules ms
  where ms.id = p_schedule_id;

  if v_club_id is null then
    raise exception '일정을 찾을 수 없습니다.';
  end if;

  if not (
    public.is_club_admin(v_club_id)
    or exists (
      select 1
      from public.match_schedules ms
      join public.club_members cm
        on cm.id = ms.host_member_id
      where ms.id = p_schedule_id
        and cm.user_id = v_user_id
        and cm.is_active = true
    )
  ) then
    raise exception '신청을 검토할 권한이 없습니다.';
  end if;

  update public.match_schedule_requests
  set status = 'rejected',
      updated_at = now()
  where schedule_id = p_schedule_id
    and club_member_id = p_club_member_id
    and status = 'pending';

  if not found then
    raise exception '대기 중인 신청이 없습니다.';
  end if;

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;


ALTER FUNCTION "public"."reject_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_club_member"("p_club_id" "uuid", "p_member_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_target_user_id uuid;
  v_target_role public.club_member_role;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = v_user_id
      and cm.role = 'owner'
      and cm.is_active = true
  ) then
    raise exception 'Only owner can remove member';
  end if;

  select cm.user_id, cm.role
    into v_target_user_id, v_target_role
  from public.club_members cm
  where cm.id = p_member_id
    and cm.club_id = p_club_id
    and cm.is_active = true;

  if v_target_user_id is null then
    raise exception 'Member not found';
  end if;

  if v_target_role = 'owner' then
    raise exception 'Owner cannot be removed';
  end if;

  if v_target_user_id = v_user_id then
    raise exception 'Cannot remove yourself';
  end if;

  update public.club_members cm
  set is_active = false,
      left_at = now()
  where cm.id = p_member_id
    and cm.club_id = p_club_id
    and cm.is_active = true;
end;
$$;


ALTER FUNCTION "public"."remove_club_member"("p_club_id" "uuid", "p_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_match_schedule"("p_schedule_id" "uuid", "p_message" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_member_role public.club_member_role;
  v_schedule record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.id, ms.club_id, ms.capacity, ms.status, ms.join_policy, ms.host_member_id
    into v_schedule
  from public.match_schedules ms
  where ms.id = p_schedule_id
  for update;

  if v_schedule.id is null then
    raise exception '일정을 찾을 수 없습니다.';
  end if;

  if v_schedule.status = 'cancelled' then
    raise exception '취소된 일정에는 신청할 수 없습니다.';
  end if;

  if v_schedule.join_policy <> 'approval_required' then
    raise exception '바로 참가형 일정입니다. 신청 대신 바로 참가를 사용해주세요.';
  end if;

  select cm.id, cm.role
    into v_member_id, v_member_role
  from public.club_members cm
  where cm.club_id = v_schedule.club_id
    and cm.user_id = v_user_id
    and cm.is_active = true
  limit 1;

  if v_member_id is null then
    raise exception '클럽 멤버만 일정에 신청할 수 있습니다.';
  end if;

  if v_member_role = 'guest' then
    raise exception '게스트는 승인형 모집에 신청할 수 없습니다.';
  end if;

  if v_member_id = v_schedule.host_member_id then
    raise exception '개설자는 자신의 일정에 신청할 수 없습니다.';
  end if;

  if exists (
    select 1
    from public.match_schedule_participants msp
    where msp.schedule_id = p_schedule_id
      and msp.club_member_id = v_member_id
  ) then
    return p_schedule_id;
  end if;

  insert into public.match_schedule_requests (
    schedule_id,
    club_member_id,
    requested_by,
    status,
    message
  )
  values (
    p_schedule_id,
    v_member_id,
    v_user_id,
    'pending',
    left(coalesce(trim(p_message), ''), 120)
  )
  on conflict (schedule_id, club_member_id)
  do update
    set requested_by = excluded.requested_by,
        status = 'pending',
        message = excluded.message,
        updated_at = now();

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;


ALTER FUNCTION "public"."request_match_schedule"("p_schedule_id" "uuid", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_club_name"("p_club_id" "uuid", "p_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  declare
    v_user_id uuid;
  begin
    v_user_id := auth.uid();

    if v_user_id is null then
      raise exception 'Not authenticated';
    end if;

    if not exists (
      select 1
      from public.club_members
      where club_id = p_club_id
        and user_id = v_user_id
        and role = 'owner'
    ) then
      raise exception 'Only owner can update club name';
    end if;

    update public.clubs
    set name = trim(p_name)
    where id = p_club_id;
  end;
  $$;


ALTER FUNCTION "public"."update_club_name"("p_club_id" "uuid", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_club_member_settings"("p_club_id" "uuid", "p_nickname" "text", "p_open_kakao_profile" boolean, "p_allow_record_search" boolean, "p_share_history" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.club_members
    where club_id = p_club_id
      and user_id = v_user_id
  ) then
    raise exception 'Not a club member';
  end if;

  update public.club_members
  set
    nickname = trim(p_nickname),
    open_kakao_profile = coalesce(p_open_kakao_profile, false),
    allow_record_search = coalesce(p_allow_record_search, false),
    share_history = coalesce(p_share_history, false)
  where club_id = p_club_id
    and user_id = v_user_id;
end;
$$;


ALTER FUNCTION "public"."update_my_club_member_settings"("p_club_id" "uuid", "p_nickname" "text", "p_open_kakao_profile" boolean, "p_allow_record_search" boolean, "p_share_history" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_club_nickname"("p_club_id" "uuid", "p_nickname" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  declare
    v_user_id uuid;
  begin
    v_user_id := auth.uid();

    if v_user_id is null then
      raise exception 'Not authenticated';
    end if;

    if not exists (
      select 1
      from public.club_members
      where club_id = p_club_id
        and user_id = v_user_id
    ) then
      raise exception 'Not a club member';
    end if;

    update public.club_members
    set nickname = trim(p_nickname)
    where club_id = p_club_id
      and user_id = v_user_id;
  end;
  $$;


ALTER FUNCTION "public"."update_my_club_nickname"("p_club_id" "uuid", "p_nickname" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."club_member_role" DEFAULT 'member'::"public"."club_member_role" NOT NULL,
    "nickname" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "open_kakao_profile" boolean DEFAULT false NOT NULL,
    "allow_record_search" boolean DEFAULT false NOT NULL,
    "share_history" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "left_at" timestamp with time zone,
    CONSTRAINT "club_members_nickname_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "nickname")) >= 2) AND ("char_length"(TRIM(BOTH FROM "nickname")) <= 24)))
);


ALTER TABLE "public"."club_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "invite_code" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invite_expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    CONSTRAINT "clubs_name_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 24)))
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "club_member_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "side" smallint NOT NULL,
    "decision" "public"."match_confirmation_decision" DEFAULT 'pending'::"public"."match_confirmation_decision" NOT NULL,
    "decided_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_confirmations_side_check" CHECK (("side" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."match_confirmations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "club_member_id" "uuid" NOT NULL,
    "side" smallint NOT NULL,
    "position" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_players_position_check" CHECK (("position" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "match_players_side_check" CHECK (("side" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."match_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "score_summary" "text" NOT NULL,
    "set_scores" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."match_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_schedule_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "club_member_id" "uuid" NOT NULL,
    "joined_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."match_schedule_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_schedule_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "club_member_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "status" "public"."match_schedule_request_status" DEFAULT 'pending'::"public"."match_schedule_request_status" NOT NULL,
    "message" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_schedule_requests_message_check" CHECK (("char_length"("message") <= 120))
);


ALTER TABLE "public"."match_schedule_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "host_member_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "linked_match_id" "uuid",
    "format" "public"."match_schedule_format" DEFAULT 'open_doubles'::"public"."match_schedule_format" NOT NULL,
    "status" "public"."match_schedule_status" DEFAULT 'open'::"public"."match_schedule_status" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "location" "text" NOT NULL,
    "court_fee" integer DEFAULT 0 NOT NULL,
    "ball_fee" integer DEFAULT 0 NOT NULL,
    "capacity" smallint NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "join_policy" "public"."match_schedule_join_policy" DEFAULT 'instant'::"public"."match_schedule_join_policy" NOT NULL,
    CONSTRAINT "match_schedules_ball_fee_check" CHECK (("ball_fee" >= 0)),
    CONSTRAINT "match_schedules_capacity_check" CHECK ((("capacity" >= 2) AND ("capacity" <= 8))),
    CONSTRAINT "match_schedules_court_fee_check" CHECK (("court_fee" >= 0)),
    CONSTRAINT "match_schedules_ends_at_after_scheduled_at" CHECK (("ends_at" > "scheduled_at")),
    CONSTRAINT "match_schedules_location_check" CHECK ((("char_length"("btrim"("location")) >= 2) AND ("char_length"("btrim"("location")) <= 80))),
    CONSTRAINT "match_schedules_notes_check" CHECK (("char_length"("notes") <= 240))
);


ALTER TABLE "public"."match_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "match_type" "public"."match_type" NOT NULL,
    "status" "public"."match_status" DEFAULT 'draft'::"public"."match_status" NOT NULL,
    "played_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "gender" "text",
    "profile_completed" boolean DEFAULT false NOT NULL,
    "auth_provider" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_profiles_completed_requires_fields" CHECK (((NOT "profile_completed") OR (("display_name" IS NOT NULL) AND (("char_length"("btrim"("display_name")) >= 2) AND ("char_length"("btrim"("display_name")) <= 24)) AND ("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'unspecified'::"text"]))))),
    CONSTRAINT "user_profiles_display_name_check" CHECK ((("display_name" IS NULL) OR (("char_length"("btrim"("display_name")) >= 2) AND ("char_length"("btrim"("display_name")) <= 24)))),
    CONSTRAINT "user_profiles_gender_check" CHECK ((("gender" IS NULL) OR ("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'unspecified'::"text"]))))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_user_id_key" UNIQUE ("club_id", "user_id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_confirmations"
    ADD CONSTRAINT "match_confirmations_match_id_club_member_id_key" UNIQUE ("match_id", "club_member_id");



ALTER TABLE ONLY "public"."match_confirmations"
    ADD CONSTRAINT "match_confirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_match_id_club_member_id_key" UNIQUE ("match_id", "club_member_id");



ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_match_id_key" UNIQUE ("match_id");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_schedule_participants"
    ADD CONSTRAINT "match_schedule_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_schedule_participants"
    ADD CONSTRAINT "match_schedule_participants_schedule_id_club_member_id_key" UNIQUE ("schedule_id", "club_member_id");



ALTER TABLE ONLY "public"."match_schedule_requests"
    ADD CONSTRAINT "match_schedule_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_schedule_requests"
    ADD CONSTRAINT "match_schedule_requests_schedule_id_club_member_id_key" UNIQUE ("schedule_id", "club_member_id");



ALTER TABLE ONLY "public"."match_schedules"
    ADD CONSTRAINT "match_schedules_linked_match_id_key" UNIQUE ("linked_match_id");



ALTER TABLE ONLY "public"."match_schedules"
    ADD CONSTRAINT "match_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_audit_logs_club_created_at" ON "public"."audit_logs" USING "btree" ("club_id", "created_at" DESC);



CREATE INDEX "idx_club_members_club" ON "public"."club_members" USING "btree" ("club_id");



CREATE UNIQUE INDEX "idx_club_members_nickname_normalized_unique" ON "public"."club_members" USING "btree" ("club_id", "lower"(TRIM(BOTH FROM "nickname")));



CREATE UNIQUE INDEX "idx_clubs_name_normalized_unique" ON "public"."clubs" USING "btree" ("lower"(TRIM(BOTH FROM "name")));



CREATE INDEX "idx_match_confirmations_match" ON "public"."match_confirmations" USING "btree" ("match_id");



CREATE INDEX "idx_match_confirmations_user" ON "public"."match_confirmations" USING "btree" ("user_id");



CREATE INDEX "idx_match_players_match" ON "public"."match_players" USING "btree" ("match_id");



CREATE INDEX "idx_match_schedule_participants_schedule" ON "public"."match_schedule_participants" USING "btree" ("schedule_id", "created_at");



CREATE INDEX "idx_match_schedule_requests_requested_by" ON "public"."match_schedule_requests" USING "btree" ("requested_by", "created_at" DESC);



CREATE INDEX "idx_match_schedule_requests_schedule_status" ON "public"."match_schedule_requests" USING "btree" ("schedule_id", "status");



CREATE INDEX "idx_match_schedules_club_scheduled_at" ON "public"."match_schedules" USING "btree" ("club_id", "scheduled_at");



CREATE INDEX "idx_matches_club_played_at" ON "public"."matches" USING "btree" ("club_id", "played_at" DESC);



CREATE INDEX "idx_user_profiles_user_id" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "clubs_set_updated_at" BEFORE UPDATE ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "match_confirmations_set_updated_at" BEFORE UPDATE ON "public"."match_confirmations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "match_results_set_updated_at" BEFORE UPDATE ON "public"."match_results" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "match_schedule_requests_set_updated_at" BEFORE UPDATE ON "public"."match_schedule_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "match_schedules_set_updated_at" BEFORE UPDATE ON "public"."match_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "matches_set_updated_at" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "user_profiles_set_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."match_confirmations"
    ADD CONSTRAINT "match_confirmations_club_member_id_fkey" FOREIGN KEY ("club_member_id") REFERENCES "public"."club_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_confirmations"
    ADD CONSTRAINT "match_confirmations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_confirmations"
    ADD CONSTRAINT "match_confirmations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_club_member_id_fkey" FOREIGN KEY ("club_member_id") REFERENCES "public"."club_members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."match_schedule_participants"
    ADD CONSTRAINT "match_schedule_participants_club_member_id_fkey" FOREIGN KEY ("club_member_id") REFERENCES "public"."club_members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."match_schedule_participants"
    ADD CONSTRAINT "match_schedule_participants_joined_by_fkey" FOREIGN KEY ("joined_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_schedule_participants"
    ADD CONSTRAINT "match_schedule_participants_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."match_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_schedule_requests"
    ADD CONSTRAINT "match_schedule_requests_club_member_id_fkey" FOREIGN KEY ("club_member_id") REFERENCES "public"."club_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_schedule_requests"
    ADD CONSTRAINT "match_schedule_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_schedule_requests"
    ADD CONSTRAINT "match_schedule_requests_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."match_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_schedules"
    ADD CONSTRAINT "match_schedules_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_schedules"
    ADD CONSTRAINT "match_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."match_schedules"
    ADD CONSTRAINT "match_schedules_host_member_id_fkey" FOREIGN KEY ("host_member_id") REFERENCES "public"."club_members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."match_schedules"
    ADD CONSTRAINT "match_schedules_linked_match_id_fkey" FOREIGN KEY ("linked_match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_insert_member" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_club_member"("club_id") AND ("actor_user_id" = "auth"."uid"())));



CREATE POLICY "audit_logs_select_member" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



ALTER TABLE "public"."club_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_members_insert_owner_bootstrap" ON "public"."club_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'owner'::"public"."club_member_role") AND (EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_members"."club_id") AND ("c"."created_by" = "auth"."uid"()))))));



CREATE POLICY "club_members_manage_admin" ON "public"."club_members" TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "club_members_select_member" ON "public"."club_members" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clubs_insert_authenticated" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "clubs_select_member" ON "public"."clubs" FOR SELECT TO "authenticated" USING (("public"."is_club_member"("id") OR ("created_by" = "auth"."uid"())));



CREATE POLICY "clubs_update_admin" ON "public"."clubs" FOR UPDATE TO "authenticated" USING ("public"."is_club_admin"("id")) WITH CHECK ("public"."is_club_admin"("id"));



ALTER TABLE "public"."match_confirmations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_confirmations_delete_manager" ON "public"."match_confirmations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_confirmations"."match_id") AND "public"."can_manage_match"("m"."club_id", "m"."created_by")))));



CREATE POLICY "match_confirmations_insert_manager" ON "public"."match_confirmations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_confirmations"."match_id") AND "public"."can_manage_match"("m"."club_id", "m"."created_by")))));



CREATE POLICY "match_confirmations_select_member" ON "public"."match_confirmations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_confirmations"."match_id") AND "public"."is_club_member"("m"."club_id")))));



CREATE POLICY "match_confirmations_update_target_user" ON "public"."match_confirmations" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."match_players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_players_manage_member" ON "public"."match_players" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_players"."match_id") AND "public"."can_manage_match"("m"."club_id", "m"."created_by"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_players"."match_id") AND "public"."can_manage_match"("m"."club_id", "m"."created_by")))));



CREATE POLICY "match_players_select_member" ON "public"."match_players" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_players"."match_id") AND "public"."is_club_member"("m"."club_id")))));



ALTER TABLE "public"."match_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_results_manage_member" ON "public"."match_results" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_results"."match_id") AND "public"."can_manage_match"("m"."club_id", "m"."created_by"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_results"."match_id") AND "public"."can_manage_match"("m"."club_id", "m"."created_by")))));



CREATE POLICY "match_results_select_member" ON "public"."match_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_results"."match_id") AND "public"."is_club_member"("m"."club_id")))));



ALTER TABLE "public"."match_schedule_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_schedule_participants_select_member" ON "public"."match_schedule_participants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."match_schedules" "ms"
  WHERE (("ms"."id" = "match_schedule_participants"."schedule_id") AND "public"."is_club_member"("ms"."club_id")))));



ALTER TABLE "public"."match_schedule_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_schedule_requests_select_member" ON "public"."match_schedule_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."match_schedules" "ms"
  WHERE (("ms"."id" = "match_schedule_requests"."schedule_id") AND "public"."is_club_member"("ms"."club_id")))));



ALTER TABLE "public"."match_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_schedules_select_member" ON "public"."match_schedules" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matches_delete_member" ON "public"."matches" FOR DELETE TO "authenticated" USING ("public"."can_manage_match"("club_id", "created_by"));



CREATE POLICY "matches_insert_member" ON "public"."matches" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."club_members" "cm"
  WHERE (("cm"."club_id" = "matches"."club_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = ANY (ARRAY['owner'::"public"."club_member_role", 'manager'::"public"."club_member_role", 'member'::"public"."club_member_role"]))))) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "matches_select_member" ON "public"."matches" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



CREATE POLICY "matches_update_member" ON "public"."matches" FOR UPDATE TO "authenticated" USING ("public"."can_manage_match"("club_id", "created_by")) WITH CHECK ("public"."can_manage_match"("club_id", "created_by"));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profiles_insert_own" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_profiles_select_own" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_profiles_update_own" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_create_match_schedule"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_create_match_schedule"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_create_match_schedule"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_match"("p_club_id" "uuid", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_match"("p_club_id" "uuid", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_match"("p_club_id" "uuid", "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_match_schedule_request"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_match_schedule_request"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_match_schedule_request"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_match_schedule"("p_club_id" "uuid", "p_format" "public"."match_schedule_format", "p_scheduled_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_court_fee" integer, "p_ball_fee" integer, "p_capacity" integer, "p_notes" "text", "p_include_host" boolean, "p_join_policy" "public"."match_schedule_join_policy") TO "anon";
GRANT ALL ON FUNCTION "public"."create_match_schedule"("p_club_id" "uuid", "p_format" "public"."match_schedule_format", "p_scheduled_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_court_fee" integer, "p_ball_fee" integer, "p_capacity" integer, "p_notes" "text", "p_include_host" boolean, "p_join_policy" "public"."match_schedule_join_policy") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_match_schedule"("p_club_id" "uuid", "p_format" "public"."match_schedule_format", "p_scheduled_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_court_fee" integer, "p_ball_fee" integer, "p_capacity" integer, "p_notes" "text", "p_include_host" boolean, "p_join_policy" "public"."match_schedule_join_policy") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code_unique"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_code_unique"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_code_unique"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_admin"("target_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_admin"("target_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_admin"("target_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_member"("target_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_member"("target_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_member"("target_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_club_by_invite"("p_invite_code" "text", "p_nickname" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_club_by_invite"("p_invite_code" "text", "p_nickname" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_club_by_invite"("p_invite_code" "text", "p_nickname" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_club_by_invite_as_guest"("p_invite_code" "text", "p_nickname" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_club_by_invite_as_guest"("p_invite_code" "text", "p_nickname" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_club_by_invite_as_guest"("p_invite_code" "text", "p_nickname" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_match_schedule"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."join_match_schedule"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_match_schedule"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_match_schedule"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_match_schedule"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_match_schedule"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_match_schedule_status"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_match_schedule_status"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_match_schedule_status"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."regenerate_club_invite_code"("p_club_id" "uuid", "p_days_valid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."regenerate_club_invite_code"("p_club_id" "uuid", "p_days_valid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."regenerate_club_invite_code"("p_club_id" "uuid", "p_days_valid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_match_schedule_request"("p_schedule_id" "uuid", "p_club_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_club_member"("p_club_id" "uuid", "p_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_club_member"("p_club_id" "uuid", "p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_club_member"("p_club_id" "uuid", "p_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_match_schedule"("p_schedule_id" "uuid", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_match_schedule"("p_schedule_id" "uuid", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_match_schedule"("p_schedule_id" "uuid", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_club_name"("p_club_id" "uuid", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_club_name"("p_club_id" "uuid", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_club_name"("p_club_id" "uuid", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_club_member_settings"("p_club_id" "uuid", "p_nickname" "text", "p_open_kakao_profile" boolean, "p_allow_record_search" boolean, "p_share_history" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_club_member_settings"("p_club_id" "uuid", "p_nickname" "text", "p_open_kakao_profile" boolean, "p_allow_record_search" boolean, "p_share_history" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_club_member_settings"("p_club_id" "uuid", "p_nickname" "text", "p_open_kakao_profile" boolean, "p_allow_record_search" boolean, "p_share_history" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_club_nickname"("p_club_id" "uuid", "p_nickname" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_club_nickname"("p_club_id" "uuid", "p_nickname" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_club_nickname"("p_club_id" "uuid", "p_nickname" "text") TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."club_members" TO "anon";
GRANT ALL ON TABLE "public"."club_members" TO "authenticated";
GRANT ALL ON TABLE "public"."club_members" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."match_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."match_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."match_confirmations" TO "service_role";



GRANT ALL ON TABLE "public"."match_players" TO "anon";
GRANT ALL ON TABLE "public"."match_players" TO "authenticated";
GRANT ALL ON TABLE "public"."match_players" TO "service_role";



GRANT ALL ON TABLE "public"."match_results" TO "anon";
GRANT ALL ON TABLE "public"."match_results" TO "authenticated";
GRANT ALL ON TABLE "public"."match_results" TO "service_role";



GRANT ALL ON TABLE "public"."match_schedule_participants" TO "anon";
GRANT ALL ON TABLE "public"."match_schedule_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."match_schedule_participants" TO "service_role";



GRANT ALL ON TABLE "public"."match_schedule_requests" TO "anon";
GRANT ALL ON TABLE "public"."match_schedule_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."match_schedule_requests" TO "service_role";



GRANT ALL ON TABLE "public"."match_schedules" TO "anon";
GRANT ALL ON TABLE "public"."match_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."match_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







