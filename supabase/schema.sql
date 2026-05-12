


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


CREATE TYPE "public"."club_record_attendance_status" AS ENUM (
    'registered',
    'checked_in'
);


ALTER TYPE "public"."club_record_attendance_status" OWNER TO "postgres";


CREATE TYPE "public"."club_record_event_status" AS ENUM (
    'draft',
    'open',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."club_record_event_status" OWNER TO "postgres";


CREATE TYPE "public"."club_record_group_code" AS ENUM (
    'A',
    'B',
    'C'
);


ALTER TYPE "public"."club_record_group_code" OWNER TO "postgres";


CREATE TYPE "public"."club_record_match_status" AS ENUM (
    'pending_result',
    'confirmed',
    'cancelled'
);


ALTER TYPE "public"."club_record_match_status" OWNER TO "postgres";


CREATE TYPE "public"."club_record_participant_type" AS ENUM (
    'member',
    'guest'
);


ALTER TYPE "public"."club_record_participant_type" OWNER TO "postgres";


CREATE TYPE "public"."club_record_slot_status" AS ENUM (
    'scheduled',
    'ready',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."club_record_slot_status" OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."apply_club_record_auto_assignments"("p_event_id" "uuid", "p_plans" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_club_id uuid;
  v_deleted_auto_slot_ids uuid[];
  v_confirmed_auto_match_count integer;
  v_plan jsonb;
  v_match_id uuid;
  v_slot_id uuid;
  v_slot_event_id uuid;
  v_slot_starts_at timestamptz;
  v_slot_is_locked boolean;
  v_participant_id uuid;
  v_unique_participant_count integer;
  v_applied_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select e.club_id
    into v_club_id
  from public.club_record_events e
  where e.id = p_event_id
    and e.is_deleted = false;

  if v_club_id is null then
    raise exception '이벤트를 찾을 수 없습니다.';
  end if;

  if not public.is_club_admin(v_club_id) then
    raise exception '자동 편성을 실행할 권한이 없습니다.';
  end if;

  select count(*)::integer
    into v_confirmed_auto_match_count
  from public.club_record_matches m
  where m.event_id = p_event_id
    and m.assignment_mode = 'auto'
    and m.status = 'confirmed';

  if coalesce(v_confirmed_auto_match_count, 0) > 0 then
    raise exception '이미 결과가 확정된 자동 편성 경기가 있어 재편성할 수 없습니다.';
  end if;

  select array_agg(m.slot_id)
    into v_deleted_auto_slot_ids
  from public.club_record_matches m
  where m.event_id = p_event_id
    and m.assignment_mode = 'auto';

  delete from public.club_record_matches m
  where m.event_id = p_event_id
    and m.assignment_mode = 'auto';

  if coalesce(array_length(v_deleted_auto_slot_ids, 1), 0) > 0 then
    update public.club_record_event_slots s
    set is_locked = false,
        status = 'scheduled'
    where s.id = any(v_deleted_auto_slot_ids);
  end if;

  if p_plans is null or jsonb_typeof(p_plans) <> 'array' then
    raise exception '자동 편성 계획 형식이 올바르지 않습니다.';
  end if;

  for v_plan in
    select value
    from jsonb_array_elements(p_plans)
  loop
    v_slot_id := (v_plan ->> 'slotId')::uuid;

    if jsonb_typeof(v_plan -> 'players') <> 'array' then
      raise exception '자동 편성 players 형식이 올바르지 않습니다.';
    end if;

    if jsonb_array_length(v_plan -> 'players') <> 4 then
      raise exception '자동 편성 경기는 정확히 4명의 참가자가 필요합니다.';
    end if;

    select count(distinct (player ->> 'participantId')::uuid)
      into v_unique_participant_count
    from jsonb_array_elements(v_plan -> 'players') as player;

    if v_unique_participant_count <> 4 then
      raise exception '자동 편성 경기는 4명의 서로 다른 참가자가 필요합니다.';
    end if;

    select s.event_id, s.starts_at, s.is_locked
      into v_slot_event_id, v_slot_starts_at, v_slot_is_locked
    from public.club_record_event_slots s
    where s.id = v_slot_id;

    if v_slot_event_id is null or v_slot_event_id <> p_event_id then
      raise exception '자동 편성 슬롯을 찾을 수 없습니다.';
    end if;

    if v_slot_is_locked then
      raise exception '이미 사용 중인 슬롯이 포함되어 자동 편성을 적용할 수 없습니다.';
    end if;

    for v_participant_id in
      select (player ->> 'participantId')::uuid
      from jsonb_array_elements(v_plan -> 'players') as player
    loop
      if not exists (
        select 1
        from public.club_record_event_participants ep
        where ep.event_id = p_event_id
          and ep.id = v_participant_id
          and (ep.arrival_time is null or ep.arrival_time <= v_slot_starts_at)
      ) then
        raise exception '자동 편성 참가자 중 현재 이벤트에 없거나 아직 도착하지 않은 인원이 포함되어 있습니다.';
      end if;

      if public.is_club_record_participant_occupied_at_slot_start(
        p_event_id,
        v_slot_starts_at,
        v_participant_id
      ) then
        raise exception '같은 시간대에 이미 배정된 참가자가 포함되어 자동 편성을 적용할 수 없습니다.';
      end if;
    end loop;

    insert into public.club_record_matches (
      event_id,
      slot_id,
      status,
      assignment_mode,
      is_manual,
      created_by,
      updated_by
    )
    values (
      p_event_id,
      v_slot_id,
      'pending_result',
      'auto',
      false,
      auth.uid(),
      auth.uid()
    )
    returning id into v_match_id;

    insert into public.club_record_match_players (
      match_id,
      participant_id,
      side,
      position
    )
    select
      v_match_id,
      (player ->> 'participantId')::uuid,
      (player ->> 'side')::integer,
      (player ->> 'position')::integer
    from jsonb_array_elements(v_plan -> 'players') as player;

    update public.club_record_event_slots s
    set is_locked = true,
        status = 'ready'
    where s.id = v_slot_id;

    v_applied_count := v_applied_count + 1;
  end loop;

  update public.club_record_events
  set assignment_dirty = false,
      last_assignment_run_at = now()
  where id = p_event_id;

  perform public.refresh_club_record_progress_for_event(p_event_id);

  return v_applied_count;
end;
$$;


ALTER FUNCTION "public"."apply_club_record_auto_assignments"("p_event_id" "uuid", "p_plans" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."can_submit_club_record_result"("p_match_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.club_record_matches m
    join public.club_record_events e
      on e.id = m.event_id
    join public.club_record_match_players mp
      on mp.match_id = m.id
    join public.club_record_event_participants ep
      on ep.id = mp.participant_id
    join public.club_members cm
      on cm.id = ep.club_member_id
    where m.id = p_match_id
      and e.is_deleted = false
      and e.status <> 'cancelled'
      and m.status = 'pending_result'
      and e.ends_at + interval '24 hours' > now()
      and cm.user_id = auth.uid()
      and cm.is_active = true
  );
$$;


ALTER FUNCTION "public"."can_submit_club_record_result"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_expired_club_record_matches"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count integer;
begin
  update public.club_record_matches m
  set status = 'cancelled',
      cancelled_at = now()
  from public.club_record_events e
  where e.id = m.event_id
    and m.status = 'pending_result'
    and e.ends_at + interval '24 hours' <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."cancel_expired_club_record_matches"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."create_club_record_manual_match"("p_event_id" "uuid", "p_slot_id" "uuid", "p_players" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_club_id uuid;
  v_match_id uuid;
  v_slot_event_id uuid;
  v_slot_is_locked boolean;
  v_slot_starts_at timestamptz;
  v_participant_id uuid;
  v_participant_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_players is null or jsonb_typeof(p_players) <> 'array' then
    raise exception '수동 경기 players 형식이 올바르지 않습니다.';
  end if;

  if jsonb_array_length(p_players) <> 4 then
    raise exception '수동 경기는 정확히 4명의 참가자가 필요합니다.';
  end if;

  select e.club_id
    into v_club_id
  from public.club_record_events e
  where e.id = p_event_id
    and e.is_deleted = false;

  if v_club_id is null then
    raise exception '이벤트를 찾을 수 없습니다.';
  end if;

  if not public.is_club_admin(v_club_id) then
    raise exception '수동 경기를 생성할 권한이 없습니다.';
  end if;

  select s.event_id, s.is_locked, s.starts_at
    into v_slot_event_id, v_slot_is_locked, v_slot_starts_at
  from public.club_record_event_slots s
  where s.id = p_slot_id;

  if v_slot_event_id is null or v_slot_event_id <> p_event_id then
    raise exception '슬롯을 찾을 수 없습니다.';
  end if;

  if v_slot_is_locked then
    raise exception '이미 사용 중인 슬롯입니다.';
  end if;

  select count(*)::integer
    into v_participant_count
  from public.club_record_event_participants ep
  where ep.event_id = p_event_id
    and (ep.arrival_time is null or ep.arrival_time <= v_slot_starts_at)
    and ep.id in (
      select distinct (player ->> 'participantId')::uuid
      from jsonb_array_elements(p_players) as player
    );

  if v_participant_count <> 4 then
    raise exception '선택한 참가자 중 일부가 현재 이벤트 참가자가 아니거나 아직 도착하지 않았습니다.';
  end if;

  for v_participant_id in
    select (player ->> 'participantId')::uuid
    from jsonb_array_elements(p_players) as player
  loop
    if public.is_club_record_participant_occupied_at_slot_start(
      p_event_id,
      v_slot_starts_at,
      v_participant_id
    ) then
      raise exception '같은 시간대에 이미 배정된 참가자가 포함되어 수동 경기를 생성할 수 없습니다.';
    end if;
  end loop;

  insert into public.club_record_matches (
    event_id,
    slot_id,
    status,
    assignment_mode,
    is_manual,
    created_by,
    updated_by
  )
  values (
    p_event_id,
    p_slot_id,
    'pending_result',
    'manual',
    true,
    auth.uid(),
    auth.uid()
  )
  returning id into v_match_id;

  insert into public.club_record_match_players (
    match_id,
    participant_id,
    side,
    position
  )
  select
    v_match_id,
    (player ->> 'participantId')::uuid,
    (player ->> 'side')::integer,
    (player ->> 'position')::integer
  from jsonb_array_elements(p_players) as player;

  update public.club_record_event_slots s
  set is_locked = true,
      status = 'ready'
  where s.id = p_slot_id;

  perform public.mark_club_record_event_assignment_dirty(p_event_id);
  perform public.refresh_club_record_progress_for_event(p_event_id);

  return v_match_id;
end;
$$;


ALTER FUNCTION "public"."create_club_record_manual_match"("p_event_id" "uuid", "p_slot_id" "uuid", "p_players" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."delete_club_record_match"("p_match_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_club_id uuid;
  v_event_id uuid;
  v_slot_id uuid;
  v_status public.club_record_match_status;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select e.club_id, m.event_id, m.slot_id, m.status
    into v_club_id, v_event_id, v_slot_id, v_status
  from public.club_record_matches m
  join public.club_record_events e
    on e.id = m.event_id
  where m.id = p_match_id
    and e.is_deleted = false;

  if v_club_id is null then
    raise exception '경기를 찾을 수 없습니다.';
  end if;

  if not public.is_club_admin(v_club_id) then
    raise exception '경기를 삭제할 권한이 없습니다.';
  end if;

  if v_status = 'confirmed' then
    raise exception '이미 확정된 경기는 삭제할 수 없습니다. 경기 단위 조정으로 처리해주세요.';
  end if;

  delete from public.club_record_matches m
  where m.id = p_match_id;

  update public.club_record_event_slots s
  set is_locked = false,
      status = 'scheduled'
  where s.id = v_slot_id;

  perform public.mark_club_record_event_assignment_dirty(v_event_id);
  perform public.refresh_club_record_progress_for_event(v_event_id);

  return v_slot_id;
end;
$$;


ALTER FUNCTION "public"."delete_club_record_match"("p_match_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_club_record_event_participants"("p_event_id" "uuid") RETURNS TABLE("id" "uuid", "event_id" "uuid", "participant_type" "public"."club_record_participant_type", "club_member_id" "uuid", "guest_profile_id" "uuid", "display_name" "text", "arrival_time" timestamp with time zone, "attendance_status" "public"."club_record_attendance_status", "group_code" "public"."club_record_group_code", "ranking_position" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    ep.id,
    ep.event_id,
    ep.participant_type,
    case
      when public.is_club_admin(e.club_id) or cm.user_id = auth.uid() then ep.club_member_id
      else null
    end as club_member_id,
    case
      when public.is_club_admin(e.club_id) or gp.guest_user_id = auth.uid() then ep.guest_profile_id
      else null
    end as guest_profile_id,
    coalesce(cm.nickname, gp.display_name, '이름 없음') as display_name,
    ep.arrival_time,
    ep.attendance_status,
    case
      when ep.participant_type = 'member' then crm.group_code
      else gp.group_code
    end as group_code,
    case
      when ep.participant_type = 'member' and public.is_club_admin(e.club_id) then crm.ranking_position
      else null
    end as ranking_position
  from public.club_record_event_participants ep
  join public.club_record_events e
    on e.id = ep.event_id
  left join public.club_members cm
    on cm.id = ep.club_member_id
  left join public.club_record_members crm
    on crm.club_member_id = ep.club_member_id
  left join public.club_record_guest_profiles gp
    on gp.id = ep.guest_profile_id
  where ep.event_id = p_event_id
    and e.is_deleted = false
    and (
      (public.is_club_record_event_participant(p_event_id) and e.status <> 'cancelled')
      or exists (
        select 1
        from public.club_members own
        where own.club_id = e.club_id
          and own.user_id = auth.uid()
          and own.is_active = true
          and own.role in ('owner', 'manager')
      )
    )
  order by ep.created_at asc;
$$;


ALTER FUNCTION "public"."get_club_record_event_participants"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_club_record_event_slots_overview"("p_event_id" "uuid") RETURNS TABLE("id" "uuid", "event_id" "uuid", "court_number" integer, "slot_order" integer, "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "status" "public"."club_record_slot_status", "is_locked" boolean, "match_id" "uuid", "match_status" "public"."club_record_match_status", "assignment_mode" "text", "is_manual" boolean, "confirmed_at" timestamp with time zone, "score_text" "text", "player_participant_id" "uuid", "player_display_name" "text", "player_side" integer, "player_position" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    s.id,
    s.event_id,
    s.court_number,
    s.slot_order,
    s.starts_at,
    s.ends_at,
    s.status,
    s.is_locked,
    m.id as match_id,
    m.status as match_status,
    m.assignment_mode,
    m.is_manual,
    m.confirmed_at,
    mr.score_text,
    mp.participant_id as player_participant_id,
    coalesce(cm.nickname, gp.display_name, '이름 없음') as player_display_name,
    mp.side as player_side,
    mp.position as player_position
  from public.club_record_event_slots s
  join public.club_record_events e
    on e.id = s.event_id
  left join public.club_record_matches m
    on m.slot_id = s.id
  left join public.club_record_match_results mr
    on mr.match_id = m.id
  left join public.club_record_match_players mp
    on mp.match_id = m.id
  left join public.club_record_event_participants ep
    on ep.id = mp.participant_id
  left join public.club_members cm
    on cm.id = ep.club_member_id
  left join public.club_record_guest_profiles gp
    on gp.id = ep.guest_profile_id
  where s.event_id = p_event_id
    and e.is_deleted = false
    and (
      (public.is_club_record_event_participant(p_event_id) and e.status <> 'cancelled')
      or exists (
        select 1
        from public.club_members own
        where own.club_id = e.club_id
          and own.user_id = auth.uid()
          and own.is_active = true
          and own.role in ('owner', 'manager')
      )
    )
  order by s.court_number asc, s.slot_order asc, mp.side asc nulls last, mp.position asc nulls last;
$$;


ALTER FUNCTION "public"."get_club_record_event_slots_overview"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_club_record_member_history"("p_club_id" "uuid", "p_target_club_member_id" "uuid") RETURNS TABLE("match_id" "uuid", "event_id" "uuid", "event_date" "date", "score_text" "text", "result" "text", "partner_names" "text"[], "opponent_names" "text"[])
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_club_admin(p_club_id) then
    raise exception '히스토리를 조회할 권한이 없습니다.';
  end if;

  return query
  with target_matches as (
    select
      m.id as match_id,
      m.event_id,
      e.event_date,
      mr.score_text,
      mr.is_draw,
      mr.winning_side,
      mp.side as target_side
    from public.club_record_event_participants ep
    join public.club_record_match_players mp
      on mp.participant_id = ep.id
    join public.club_record_matches m
      on m.id = mp.match_id
    join public.club_record_events e
      on e.id = m.event_id
    join public.club_record_match_results mr
      on mr.match_id = m.id
      where ep.club_member_id = p_target_club_member_id
        and e.club_id = p_club_id
        and e.is_deleted = false
        and e.status <> 'cancelled'
        and m.status = 'confirmed'
  )
  select
    tm.match_id,
    tm.event_id,
    tm.event_date,
    tm.score_text,
    case
      when tm.is_draw then 'draw'
      when tm.target_side = tm.winning_side then 'win'
      else 'loss'
    end as result,
    coalesce(
      array_agg(distinct coalesce(cm.nickname, gp.display_name, '게스트'))
        filter (where mp.side = tm.target_side and ep.club_member_id is distinct from p_target_club_member_id),
      '{}'::text[]
    ) as partner_names,
    coalesce(
      array_agg(distinct coalesce(cm.nickname, gp.display_name, '게스트'))
        filter (where mp.side <> tm.target_side),
      '{}'::text[]
    ) as opponent_names
  from target_matches tm
  join public.club_record_match_players mp
    on mp.match_id = tm.match_id
  join public.club_record_event_participants ep
    on ep.id = mp.participant_id
  left join public.club_members cm
    on cm.id = ep.club_member_id
  left join public.club_record_guest_profiles gp
    on gp.id = ep.guest_profile_id
  group by
    tm.match_id,
    tm.event_id,
    tm.event_date,
    tm.score_text,
    tm.is_draw,
    tm.winning_side,
    tm.target_side
  order by tm.event_date desc, tm.match_id desc;
end;
$$;


ALTER FUNCTION "public"."get_club_record_member_history"("p_club_id" "uuid", "p_target_club_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_club_record_monthly_public_card"("p_club_id" "uuid", "p_month_start" "date") RETURNS TABLE("club_member_id" "uuid", "nickname" "text", "wins" integer, "losses" integer, "draws" integer, "win_rate" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with stats as (
    select
      ep.club_member_id,
      sum(case when mr.is_draw then 1 else 0 end)::integer as draws,
      sum(case when not mr.is_draw and mp.side = mr.winning_side then 1 else 0 end)::integer as wins,
      sum(case when not mr.is_draw and mp.side = mr.losing_side then 1 else 0 end)::integer as losses
    from public.club_record_matches m
    join public.club_record_events e
      on e.id = m.event_id
    join public.club_record_match_results mr
      on mr.match_id = m.id
    join public.club_record_match_players mp
      on mp.match_id = m.id
    join public.club_record_event_participants ep
      on ep.id = mp.participant_id
    where e.club_id = p_club_id
      and e.event_date >= p_month_start
      and e.event_date < (p_month_start + interval '1 month')
      and e.is_deleted = false
      and e.status <> 'cancelled'
      and m.status = 'confirmed'
      and ep.club_member_id is not null
    group by ep.club_member_id
  )
  select
    s.club_member_id,
    cm.nickname,
    s.wins,
    s.losses,
    s.draws,
    case
      when (s.wins + s.losses + s.draws) = 0 then 0::numeric
      else round((s.wins::numeric / (s.wins + s.losses + s.draws)::numeric) * 100, 2)
    end as win_rate
  from stats s
  join public.club_members cm
    on cm.id = s.club_member_id
  join public.club_record_members crm
    on crm.club_member_id = s.club_member_id
  where public.is_club_member(p_club_id)
  order by s.wins desc, win_rate desc, crm.ranking_position asc;
$$;


ALTER FUNCTION "public"."get_club_record_monthly_public_card"("p_club_id" "uuid", "p_month_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_active_club_member_id"("p_club_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select cm.id
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.user_id = auth.uid()
    and cm.is_active = true
  limit 1;
$$;


ALTER FUNCTION "public"."get_my_active_club_member_id"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_club_record_history"("p_club_id" "uuid") RETURNS TABLE("match_id" "uuid", "event_id" "uuid", "event_date" "date", "score_text" "text", "result" "text", "partner_names" "text"[], "opponent_names" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with my_member as (
    select public.get_my_active_club_member_id(p_club_id) as club_member_id
  ),
  my_matches as (
    select
      m.id as match_id,
      m.event_id,
      e.event_date,
      mr.score_text,
      mr.is_draw,
      mr.winning_side,
      mp.side as my_side
    from my_member me
    join public.club_record_event_participants ep
      on ep.club_member_id = me.club_member_id
    join public.club_record_match_players mp
      on mp.participant_id = ep.id
    join public.club_record_matches m
      on m.id = mp.match_id
    join public.club_record_events e
      on e.id = m.event_id
    join public.club_record_match_results mr
      on mr.match_id = m.id
    where e.club_id = p_club_id
      and e.is_deleted = false
      and e.status <> 'cancelled'
      and m.status = 'confirmed'
  )
  select
    mm.match_id,
    mm.event_id,
    mm.event_date,
    mm.score_text,
    case
      when mm.is_draw then 'draw'
      when mm.my_side = mm.winning_side then 'win'
      else 'loss'
    end as result,
    coalesce(
      array_agg(distinct coalesce(cm.nickname, gp.display_name, '게스트'))
        filter (where mp.side = mm.my_side and ep.club_member_id is distinct from me.club_member_id),
      '{}'::text[]
    ) as partner_names,
    coalesce(
      array_agg(distinct coalesce(cm.nickname, gp.display_name, '게스트'))
        filter (where mp.side <> mm.my_side),
      '{}'::text[]
    ) as opponent_names
  from my_matches mm
  join my_member me on true
  join public.club_record_match_players mp
    on mp.match_id = mm.match_id
  join public.club_record_event_participants ep
    on ep.id = mp.participant_id
  left join public.club_members cm
    on cm.id = ep.club_member_id
  left join public.club_record_guest_profiles gp
    on gp.id = ep.guest_profile_id
  group by
    mm.match_id,
    mm.event_id,
    mm.event_date,
    mm.score_text,
    mm.is_draw,
    mm.winning_side,
    mm.my_side,
    me.club_member_id
  order by mm.event_date desc, mm.match_id desc;
$$;


ALTER FUNCTION "public"."get_my_club_record_history"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_club_record_assignment_dirty_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.mark_club_record_event_assignment_dirty(
    coalesce(new.event_id, old.event_id)
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."handle_club_record_assignment_dirty_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_club_record_event_participant_stats_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.refresh_club_record_member_stats_for_event(
    coalesce(new.event_id, old.event_id)
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."handle_club_record_event_participant_stats_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_club_record_event_soft_delete_stats_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.is_deleted is distinct from old.is_deleted then
    perform public.refresh_club_record_member_stats_for_event(new.id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_club_record_event_soft_delete_stats_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_club_record_match_stats_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.refresh_club_record_member_stats_for_event(
    coalesce(new.event_id, old.event_id)
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."handle_club_record_match_stats_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_club_record_progress_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.refresh_club_record_progress_for_event(
    coalesce(new.event_id, old.event_id)
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."handle_club_record_progress_sync"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."is_club_record_event_participant"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.club_record_event_participants ep
    left join public.club_members cm
      on cm.id = ep.club_member_id
    left join public.club_record_guest_profiles gp
      on gp.id = ep.guest_profile_id
    where ep.event_id = p_event_id
      and (
        (cm.user_id = auth.uid() and cm.is_active = true)
        or gp.guest_user_id = auth.uid()
      )
  );
$$;


ALTER FUNCTION "public"."is_club_record_event_participant"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_record_match_participant"("p_match_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.club_record_match_players mp
    join public.club_record_event_participants ep
      on ep.id = mp.participant_id
    left join public.club_members cm
      on cm.id = ep.club_member_id
    left join public.club_record_guest_profiles gp
      on gp.id = ep.guest_profile_id
    where mp.match_id = p_match_id
      and (
        (cm.user_id = auth.uid() and cm.is_active = true)
        or gp.guest_user_id = auth.uid()
      )
  );
$$;


ALTER FUNCTION "public"."is_club_record_match_participant"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_record_match_player_participant"("p_match_id" "uuid", "p_participant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.club_record_match_players mp
    where mp.match_id = p_match_id
      and mp.participant_id = p_participant_id
  );
$$;


ALTER FUNCTION "public"."is_club_record_match_player_participant"("p_match_id" "uuid", "p_participant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_record_participant_occupied_at_slot_start"("p_event_id" "uuid", "p_slot_starts_at" timestamp with time zone, "p_participant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.club_record_match_players mp
    join public.club_record_matches m
      on m.id = mp.match_id
    join public.club_record_event_slots s
      on s.id = m.slot_id
    where m.event_id = p_event_id
      and mp.participant_id = p_participant_id
      and s.starts_at = p_slot_starts_at
  );
$$;


ALTER FUNCTION "public"."is_club_record_participant_occupied_at_slot_start"("p_event_id" "uuid", "p_slot_starts_at" timestamp with time zone, "p_participant_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."join_club_record_event_guest_by_invite_code"("p_code" "text", "p_display_name" "text", "p_gender" "text" DEFAULT NULL::"text", "p_career_text" "text" DEFAULT NULL::"text", "p_group_code" "public"."club_record_group_code" DEFAULT NULL::"public"."club_record_group_code", "p_arrival_time" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("event_id" "uuid", "club_id" "uuid", "event_date" "date", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "guest_profile_id" "uuid", "guest_user_id" "uuid", "display_name" "text", "gender" "text", "career_text" "text", "group_code" "public"."club_record_group_code", "linked_club_member_id" "uuid", "participant_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_event_id uuid;
  v_club_id uuid;
  v_event_date date;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_guest_profile_id uuid;
  v_participant_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select e.id, e.club_id, e.event_date, e.starts_at, e.ends_at
    into v_event_id, v_club_id, v_event_date, v_starts_at, v_ends_at
  from public.club_record_guest_invites gi
  join public.club_record_events e
    on e.id = gi.event_id
  where gi.code = upper(btrim(p_code))
    and gi.is_active = true
    and e.is_deleted = false
    and e.status <> 'cancelled'
    and (gi.expires_at is null or gi.expires_at > now())
  limit 1;

  if v_event_id is null then
    raise exception '유효한 게스트 초대코드를 찾을 수 없습니다.';
  end if;

  insert into public.club_record_guest_profiles (
    club_id,
    guest_user_id,
    display_name,
    gender,
    career_text,
    group_code
  )
  values (
    v_club_id,
    v_user_id,
    nullif(btrim(p_display_name), ''),
    nullif(btrim(p_gender), ''),
    nullif(btrim(p_career_text), ''),
    p_group_code
  )
  on conflict on constraint club_record_guest_profiles_club_id_guest_user_id_key do update
  set display_name = excluded.display_name,
      gender = excluded.gender,
      career_text = excluded.career_text,
      group_code = excluded.group_code,
      updated_at = now()
  returning id into v_guest_profile_id;

  insert into public.club_record_event_participants (
    event_id,
    participant_type,
    guest_profile_id,
    arrival_time,
    added_by
  )
  values (
    v_event_id,
    'guest',
    v_guest_profile_id,
    p_arrival_time,
    v_user_id
  )
  on conflict on constraint club_record_event_participants_event_id_guest_profile_id_key do update
  set arrival_time = coalesce(excluded.arrival_time, public.club_record_event_participants.arrival_time),
      updated_at = now()
  returning id into v_participant_id;

  return query
  select
    v_event_id,
    v_club_id,
    v_event_date,
    v_starts_at,
    v_ends_at,
    v_guest_profile_id,
    v_user_id,
    nullif(btrim(p_display_name), ''),
    nullif(btrim(p_gender), ''),
    nullif(btrim(p_career_text), ''),
    p_group_code,
    null::uuid,
    v_participant_id;
end;
$$;


ALTER FUNCTION "public"."join_club_record_event_guest_by_invite_code"("p_code" "text", "p_display_name" "text", "p_gender" "text", "p_career_text" "text", "p_group_code" "public"."club_record_group_code", "p_arrival_time" timestamp with time zone) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."mark_club_record_event_assignment_dirty"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.club_record_events e
  set assignment_dirty = true
  where e.id = p_event_id
    and e.is_deleted = false
    and e.assignment_dirty = false;
end;
$$;


ALTER FUNCTION "public"."mark_club_record_event_assignment_dirty"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_club_record_ranking"("p_club_id" "uuid", "p_club_member_id" "uuid", "p_target_position" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_current_position integer;
  v_max_position integer;
  v_target_position integer;
  v_temp_position integer;
  v_offset integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_club_admin(p_club_id) then
    raise exception '랭킹을 수정할 권한이 없습니다.';
  end if;

  select ranking_position
    into v_current_position
  from public.club_record_members
  where club_id = p_club_id
    and club_member_id = p_club_member_id
  for update;

  if v_current_position is null then
    raise exception '대상 멤버의 랭킹 정보를 찾을 수 없습니다.';
  end if;

  select count(*)
    into v_max_position
  from public.club_record_members
  where club_id = p_club_id;

  v_target_position := greatest(1, least(p_target_position, v_max_position));

  if v_target_position = v_current_position then
    return;
  end if;

  v_offset := v_max_position + 1000;
  v_temp_position := v_offset * 2;

  update public.club_record_members
  set ranking_position = v_temp_position
  where club_id = p_club_id
    and club_member_id = p_club_member_id;

  if v_target_position < v_current_position then
    update public.club_record_members
    set ranking_position = ranking_position + v_offset
    where club_id = p_club_id
      and ranking_position >= v_target_position
      and ranking_position < v_current_position;

    update public.club_record_members
    set ranking_position = ranking_position - v_offset + 1
    where club_id = p_club_id
      and ranking_position >= v_target_position + v_offset
      and ranking_position < v_current_position + v_offset;
  else
    update public.club_record_members
    set ranking_position = ranking_position + v_offset
    where club_id = p_club_id
      and ranking_position > v_current_position
      and ranking_position <= v_target_position;

    update public.club_record_members
    set ranking_position = ranking_position - v_offset - 1
    where club_id = p_club_id
      and ranking_position > v_current_position + v_offset
      and ranking_position <= v_target_position + v_offset;
  end if;

  update public.club_record_members
  set ranking_position = v_target_position
  where club_id = p_club_id
    and club_member_id = p_club_member_id;

  perform public.recalculate_club_record_groups(p_club_id);

  insert into public.club_record_ranking_audits (
    club_id,
    target_club_member_id,
    before_ranking_position,
    after_ranking_position,
    changed_by
  )
  values (
    p_club_id,
    p_club_member_id,
    v_current_position,
    v_target_position,
    v_user_id
  );
end;
$$;


ALTER FUNCTION "public"."move_club_record_ranking"("p_club_id" "uuid", "p_club_member_id" "uuid", "p_target_position" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_club_record_confirmed_event_cancel"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (
    (new.is_deleted = true and old.is_deleted = false)
    or (new.status = 'cancelled' and old.status <> 'cancelled')
  ) and exists (
    select 1
    from public.club_record_matches m
    where m.event_id = old.id
      and m.status = 'confirmed'
  ) then
    raise exception '확정된 경기가 있는 club record 이벤트는 취소하거나 삭제할 수 없습니다.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_club_record_confirmed_event_cancel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_club_record_confirmed_match_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.status = 'confirmed' then
    raise exception '확정된 club record 경기는 삭제할 수 없습니다.';
  end if;

  return old;
end;
$$;


ALTER FUNCTION "public"."prevent_club_record_confirmed_match_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_club_record_linked_participant_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if exists (
    select 1
    from public.club_record_match_players mp
    where mp.participant_id = old.id
  ) then
    raise exception '경기에 연결된 참가자는 직접 삭제할 수 없습니다. 참가자 삭제 RPC를 사용해주세요.';
  end if;

  return old;
end;
$$;


ALTER FUNCTION "public"."prevent_club_record_linked_participant_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_club_record_groups"("p_club_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_total integer;
  v_a_count integer;
  v_b_count integer;
begin
  select count(*)
    into v_total
  from public.club_record_members crm
  where crm.club_id = p_club_id;

  if coalesce(v_total, 0) = 0 then
    return;
  end if;

  select
    greatest(1, ceil(v_total * (group_a_percent / 100.0))::integer),
    greatest(0, ceil(v_total * (group_b_percent / 100.0))::integer)
    into v_a_count, v_b_count
  from public.club_record_settings
  where club_id = p_club_id;

  if v_a_count is null then
    v_a_count := greatest(1, ceil(v_total * 0.2)::integer);
    v_b_count := greatest(0, ceil(v_total * 0.3)::integer);
  end if;

  with ordered as (
    select
      crm.id,
      row_number() over (order by crm.ranking_position asc) as row_num
    from public.club_record_members crm
    where crm.club_id = p_club_id
  )
  update public.club_record_members crm
  set group_code = case
    when ordered.row_num <= v_a_count then 'A'::public.club_record_group_code
    when ordered.row_num <= (v_a_count + v_b_count) then 'B'::public.club_record_group_code
    else 'C'::public.club_record_group_code
  end
  from ordered
  where crm.id = ordered.id;
end;
$$;


ALTER FUNCTION "public"."recalculate_club_record_groups"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_club_record_event_status"("p_event_id" "uuid") RETURNS "public"."club_record_event_status"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_deleted boolean;
  v_current_status public.club_record_event_status;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_participant_count integer;
  v_total_match_count integer;
  v_pending_match_count integer;
  v_next_status public.club_record_event_status;
begin
  select
    e.is_deleted,
    e.status,
    e.starts_at,
    e.ends_at
    into v_is_deleted, v_current_status, v_starts_at, v_ends_at
  from public.club_record_events e
  where e.id = p_event_id;

  if v_current_status is null then
    raise exception '이벤트를 찾을 수 없습니다.';
  end if;

  if v_is_deleted or v_current_status = 'cancelled' then
    return 'cancelled'::public.club_record_event_status;
  end if;

  select count(*)::integer
    into v_participant_count
  from public.club_record_event_participants ep
  where ep.event_id = p_event_id;

  if coalesce(v_participant_count, 0) = 0 then
    v_next_status := 'draft';
  else
    select
      count(*)::integer,
      count(*) filter (where m.status = 'pending_result')::integer
      into v_total_match_count, v_pending_match_count
    from public.club_record_matches m
    where m.event_id = p_event_id;

    if now() < v_starts_at then
      v_next_status := 'open';
    elsif coalesce(v_total_match_count, 0) = 0 then
      v_next_status := 'in_progress';
    elsif coalesce(v_pending_match_count, 0) = 0 and now() >= v_ends_at then
      v_next_status := 'completed';
    else
      v_next_status := 'in_progress';
    end if;
  end if;

  update public.club_record_events e
  set status = v_next_status
  where e.id = p_event_id
    and e.status <> v_next_status;

  return v_next_status;
end;
$$;


ALTER FUNCTION "public"."refresh_club_record_event_status"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_club_record_member_stats_for_club"("p_club_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.club_record_members crm
  set attendance_count = (
        select count(distinct e.id)::integer
        from public.club_record_event_participants ep
        join public.club_record_events e
          on e.id = ep.event_id
        where ep.club_member_id = crm.club_member_id
          and e.is_deleted = false
      ),
      match_count = (
        select count(distinct m.id)::integer
        from public.club_record_match_players mp
        join public.club_record_event_participants ep
          on ep.id = mp.participant_id
        join public.club_record_matches m
          on m.id = mp.match_id
        join public.club_record_events e
          on e.id = m.event_id
        where ep.club_member_id = crm.club_member_id
          and m.status = 'confirmed'
          and e.is_deleted = false
          and e.status <> 'cancelled'
      )
  where crm.club_id = p_club_id;
$$;


ALTER FUNCTION "public"."refresh_club_record_member_stats_for_club"("p_club_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_club_record_member_stats_for_event"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_club_id uuid;
begin
  select e.club_id
    into v_club_id
  from public.club_record_events e
  where e.id = p_event_id;

  if v_club_id is null then
    return;
  end if;

  perform public.refresh_club_record_member_stats_for_club(v_club_id);
end;
$$;


ALTER FUNCTION "public"."refresh_club_record_member_stats_for_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_club_record_progress_for_event"("p_event_id" "uuid") RETURNS "public"."club_record_event_status"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_status public.club_record_event_status;
begin
  perform public.refresh_club_record_slot_statuses_for_event(p_event_id);
  v_status := public.refresh_club_record_event_status(p_event_id);
  return v_status;
end;
$$;


ALTER FUNCTION "public"."refresh_club_record_progress_for_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_club_record_slot_statuses_for_event"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.club_record_event_slots s
  set status = case
        when m.id is null then 'scheduled'::public.club_record_slot_status
        when m.status = 'pending_result' then 'ready'::public.club_record_slot_status
        when m.status = 'confirmed' then 'completed'::public.club_record_slot_status
        else 'cancelled'::public.club_record_slot_status
      end,
      is_locked = (m.id is not null)
  from public.club_record_matches m
  where s.event_id = p_event_id
    and s.id = m.slot_id;

  update public.club_record_event_slots s
  set status = 'scheduled',
      is_locked = false
  where s.event_id = p_event_id
    and not exists (
      select 1
      from public.club_record_matches m
      where m.slot_id = s.id
    );
$$;


ALTER FUNCTION "public"."refresh_club_record_slot_statuses_for_event"("p_event_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."remove_club_record_event_participant"("p_event_id" "uuid", "p_participant_id" "uuid") RETURNS TABLE("deleted_match_count" integer, "released_slot_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_club_id uuid;
  v_confirmed_match_count integer;
  v_deleted_match_count integer := 0;
  v_released_slot_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select e.club_id
    into v_club_id
  from public.club_record_events e
  where e.id = p_event_id
    and e.is_deleted = false;

  if v_club_id is null then
    raise exception '이벤트를 찾을 수 없습니다.';
  end if;

  if not public.is_club_admin(v_club_id) then
    raise exception '참가자를 삭제할 권한이 없습니다.';
  end if;

  if not exists (
    select 1
    from public.club_record_event_participants ep
    where ep.id = p_participant_id
      and ep.event_id = p_event_id
  ) then
    raise exception '참가자 정보를 찾을 수 없습니다.';
  end if;

  select count(distinct m.id)::integer
    into v_confirmed_match_count
  from public.club_record_match_players mp
  join public.club_record_matches m
    on m.id = mp.match_id
  where mp.participant_id = p_participant_id
    and m.event_id = p_event_id
    and m.status = 'confirmed';

  if coalesce(v_confirmed_match_count, 0) > 0 then
    raise exception '이미 결과가 확정된 경기가 있어 참가자를 삭제할 수 없습니다. 경기에서 먼저 조정해주세요.';
  end if;

  with target_matches as (
    select distinct m.id, m.slot_id
    from public.club_record_match_players mp
    join public.club_record_matches m
      on m.id = mp.match_id
    where mp.participant_id = p_participant_id
      and m.event_id = p_event_id
      and m.status in ('pending_result', 'cancelled')
  ), deleted_matches as (
    delete from public.club_record_matches m
    where m.id in (select tm.id from target_matches tm)
    returning m.id, m.slot_id
  ), released_slots as (
    update public.club_record_event_slots s
    set is_locked = false,
        status = 'scheduled'
    where s.id in (select dm.slot_id from deleted_matches dm)
    returning s.id
  )
  select
    (select count(*)::integer from deleted_matches),
    (select count(*)::integer from released_slots)
    into v_deleted_match_count, v_released_slot_count;

  delete from public.club_record_event_participants ep
  where ep.id = p_participant_id
    and ep.event_id = p_event_id;

  perform public.mark_club_record_event_assignment_dirty(p_event_id);
  perform public.refresh_club_record_member_stats_for_event(p_event_id);
  perform public.refresh_club_record_progress_for_event(p_event_id);

  return query
  select
    coalesce(v_deleted_match_count, 0),
    coalesce(v_released_slot_count, 0);
end;
$$;


ALTER FUNCTION "public"."remove_club_record_event_participant"("p_event_id" "uuid", "p_participant_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."submit_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) RETURNS TABLE("match_id" "uuid", "score_text" "text", "is_draw" boolean, "winning_side" integer, "losing_side" integer, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_submit_club_record_result(p_match_id) then
    raise exception '경기 결과를 입력할 권한이 없습니다.';
  end if;

  select ep.id
    into v_participant_id
  from public.club_record_match_players mp
  join public.club_record_event_participants ep
    on ep.id = mp.participant_id
  join public.club_members cm
    on cm.id = ep.club_member_id
  where mp.match_id = p_match_id
    and cm.user_id = auth.uid()
    and cm.is_active = true
  limit 1;

  if v_participant_id is null then
    raise exception '경기 참가자 정보를 찾을 수 없습니다.';
  end if;

  insert into public.club_record_match_results (
    match_id,
    winning_side,
    losing_side,
    is_draw,
    score_text,
    entered_by_participant_id
  )
  values (
    p_match_id,
    p_winning_side,
    p_losing_side,
    p_is_draw,
    btrim(p_score_text),
    v_participant_id
  );

  update public.club_record_matches
  set status = 'confirmed',
      result_entered_by = auth.uid(),
      result_entered_at = now(),
      confirmed_at = now()
  where id = p_match_id;

  perform public.refresh_club_record_member_stats_for_event((
    select m.event_id
    from public.club_record_matches m
    where m.id = p_match_id
  ));
  perform public.refresh_club_record_progress_for_event((
    select m.event_id
    from public.club_record_matches m
    where m.id = p_match_id
  ));

  return query
  select
    mr.match_id,
    mr.score_text,
    mr.is_draw,
    mr.winning_side,
    mr.losing_side,
    mr.created_at
  from public.club_record_match_results mr
  where mr.match_id = p_match_id;
end;
$$;


ALTER FUNCTION "public"."submit_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_club_record_members"("p_club_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_inserted integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_club_admin(p_club_id) then
    raise exception '클럽 회원 랭킹을 동기화할 권한이 없습니다.';
  end if;

  perform pg_advisory_xact_lock(hashtext('club_record_members:' || p_club_id::text));

  with current_max as (
    select coalesce(max(ranking_position), 0) as max_position
    from public.club_record_members
    where club_id = p_club_id
  ),
  candidates as (
    select
      cm.id as club_member_id,
      cm.created_at,
      row_number() over (
        order by cm.created_at asc, cm.nickname asc, cm.id asc
      ) as row_num
    from public.club_members cm
    left join public.club_record_members crm
      on crm.club_member_id = cm.id
    where cm.club_id = p_club_id
      and cm.is_active = true
      and cm.role in ('owner', 'manager', 'member')
      and crm.id is null
  )
  insert into public.club_record_members (
    club_id,
    club_member_id,
    ranking_position,
    group_code,
    joined_on
  )
  select
    p_club_id,
    candidates.club_member_id,
    current_max.max_position + candidates.row_num,
    'C'::public.club_record_group_code,
    candidates.created_at::date
  from candidates
  cross join current_max;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    perform public.recalculate_club_record_groups(p_club_id);
  end if;

  return v_inserted;
end;
$$;


ALTER FUNCTION "public"."sync_club_record_members"("p_club_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) RETURNS TABLE("match_id" "uuid", "score_text" "text", "is_draw" boolean, "winning_side" integer, "losing_side" integer, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_club_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select e.club_id
    into v_club_id
  from public.club_record_matches m
  join public.club_record_events e
    on e.id = m.event_id
  where m.id = p_match_id
    and e.is_deleted = false
    and e.status <> 'cancelled';

  if v_club_id is null then
    raise exception '경기를 찾을 수 없습니다.';
  end if;

  if not public.is_club_admin(v_club_id) then
    raise exception '경기 결과를 수정할 권한이 없습니다.';
  end if;

  insert into public.club_record_match_results (
    match_id,
    winning_side,
    losing_side,
    is_draw,
    score_text,
    entered_by_participant_id
  )
  values (
    p_match_id,
    p_winning_side,
    p_losing_side,
    p_is_draw,
    btrim(p_score_text),
    null
  )
  on conflict on constraint club_record_match_results_match_id_key do update
  set winning_side = excluded.winning_side,
      losing_side = excluded.losing_side,
      is_draw = excluded.is_draw,
      score_text = excluded.score_text,
      updated_at = now();

  update public.club_record_matches
  set status = 'confirmed',
      confirmed_at = now(),
      result_entered_by = auth.uid(),
      result_entered_at = now(),
      updated_by = auth.uid()
  where id = p_match_id;

  perform public.refresh_club_record_member_stats_for_event((
    select m.event_id
    from public.club_record_matches m
    where m.id = p_match_id
  ));
  perform public.refresh_club_record_progress_for_event((
    select m.event_id
    from public.club_record_matches m
    where m.id = p_match_id
  ));

  return query
  select
    mr.match_id,
    mr.score_text,
    mr.is_draw,
    mr.winning_side,
    mr.losing_side,
    mr.created_at
  from public.club_record_match_results mr
  where mr.match_id = p_match_id;
end;
$$;


ALTER FUNCTION "public"."update_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."validate_club_record_event_participant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_club_id uuid;
  v_participant_club_id uuid;
  v_is_active boolean;
begin
  select e.club_id
    into v_event_club_id
  from public.club_record_events e
  where e.id = new.event_id
    and e.is_deleted = false;

  if v_event_club_id is null then
    raise exception '이벤트를 찾을 수 없습니다.';
  end if;

  if new.participant_type = 'member' then
    select cm.club_id, cm.is_active
      into v_participant_club_id, v_is_active
    from public.club_members cm
    where cm.id = new.club_member_id;

    if v_participant_club_id is null
      or v_participant_club_id <> v_event_club_id
      or v_is_active is distinct from true then
      raise exception '같은 클럽의 활성 회원만 club record 이벤트 참가자로 추가할 수 있습니다.';
    end if;
  elsif new.participant_type = 'guest' then
    select gp.club_id
      into v_participant_club_id
    from public.club_record_guest_profiles gp
    where gp.id = new.guest_profile_id;

    if v_participant_club_id is null
      or v_participant_club_id <> v_event_club_id then
      raise exception '같은 클럽의 게스트만 club record 이벤트 참가자로 추가할 수 있습니다.';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_club_record_event_participant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_club_record_guest_invite_code"("p_code" "text") RETURNS TABLE("event_id" "uuid", "club_id" "uuid", "event_date" "date", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select e.id, e.club_id, e.event_date, e.starts_at, e.ends_at
  from public.club_record_guest_invites gi
  join public.club_record_events e
    on e.id = gi.event_id
  where gi.code = upper(btrim(p_code))
    and gi.is_active = true
    and e.is_deleted = false
    and e.status <> 'cancelled'
    and (gi.expires_at is null or gi.expires_at > now())
  limit 1;
$$;


ALTER FUNCTION "public"."verify_club_record_guest_invite_code"("p_code" "text") OWNER TO "postgres";

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


CREATE TABLE IF NOT EXISTS "public"."club_record_event_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "participant_type" "public"."club_record_participant_type" NOT NULL,
    "club_member_id" "uuid",
    "guest_profile_id" "uuid",
    "arrival_time" timestamp with time zone,
    "attendance_status" "public"."club_record_attendance_status" DEFAULT 'registered'::"public"."club_record_attendance_status" NOT NULL,
    "added_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_record_event_participants_check" CHECK (((("participant_type" = 'member'::"public"."club_record_participant_type") AND ("club_member_id" IS NOT NULL) AND ("guest_profile_id" IS NULL)) OR (("participant_type" = 'guest'::"public"."club_record_participant_type") AND ("guest_profile_id" IS NOT NULL) AND ("club_member_id" IS NULL))))
);


ALTER TABLE "public"."club_record_event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_event_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "court_number" integer NOT NULL,
    "slot_order" integer NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "status" "public"."club_record_slot_status" DEFAULT 'scheduled'::"public"."club_record_slot_status" NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_record_event_slots_check" CHECK (("starts_at" < "ends_at")),
    CONSTRAINT "club_record_event_slots_court_number_check" CHECK (("court_number" >= 1)),
    CONSTRAINT "club_record_event_slots_slot_order_check" CHECK (("slot_order" >= 1))
);


ALTER TABLE "public"."club_record_event_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "title" "text",
    "event_date" "date" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "court_count" integer NOT NULL,
    "status" "public"."club_record_event_status" DEFAULT 'draft'::"public"."club_record_event_status" NOT NULL,
    "assignment_dirty" boolean DEFAULT false NOT NULL,
    "last_assignment_run_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_record_events_check" CHECK (("starts_at" < "ends_at")),
    CONSTRAINT "club_record_events_court_count_check" CHECK (("court_count" >= 1))
);


ALTER TABLE "public"."club_record_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_guest_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "issued_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."club_record_guest_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_guest_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "guest_user_id" "uuid",
    "display_name" "text",
    "gender" "text",
    "career_text" "text",
    "group_code" "public"."club_record_group_code",
    "operator_note" "text",
    "linked_club_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."club_record_guest_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_match_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "side" integer NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_record_match_players_position_check" CHECK (("position" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "club_record_match_players_side_check" CHECK (("side" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."club_record_match_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_match_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "winning_side" integer,
    "losing_side" integer,
    "is_draw" boolean DEFAULT false NOT NULL,
    "score_text" "text" NOT NULL,
    "entered_by_participant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_record_match_results_check" CHECK (((("is_draw" = true) AND ("winning_side" IS NULL) AND ("losing_side" IS NULL)) OR (("is_draw" = false) AND ("winning_side" = ANY (ARRAY[1, 2])) AND ("losing_side" = ANY (ARRAY[1, 2])) AND ("winning_side" <> "losing_side")))),
    CONSTRAINT "club_record_match_results_score_text_check" CHECK (("btrim"("score_text") <> ''::"text"))
);


ALTER TABLE "public"."club_record_match_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "slot_id" "uuid" NOT NULL,
    "status" "public"."club_record_match_status" DEFAULT 'pending_result'::"public"."club_record_match_status" NOT NULL,
    "assignment_mode" "text" NOT NULL,
    "is_manual" boolean DEFAULT false NOT NULL,
    "result_entered_by" "uuid",
    "result_entered_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_record_matches_assignment_mode_check" CHECK (("assignment_mode" = ANY (ARRAY['auto'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."club_record_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "club_member_id" "uuid" NOT NULL,
    "ranking_position" integer NOT NULL,
    "group_code" "public"."club_record_group_code" NOT NULL,
    "attendance_count" integer DEFAULT 0 NOT NULL,
    "match_count" integer DEFAULT 0 NOT NULL,
    "joined_on" "date",
    "operator_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_record_members_attendance_count_check" CHECK (("attendance_count" >= 0)),
    CONSTRAINT "club_record_members_match_count_check" CHECK (("match_count" >= 0)),
    CONSTRAINT "club_record_members_ranking_position_check" CHECK (("ranking_position" >= 1))
);


ALTER TABLE "public"."club_record_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_ranking_audits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "target_club_member_id" "uuid" NOT NULL,
    "before_ranking_position" integer,
    "after_ranking_position" integer NOT NULL,
    "before_group_code" "public"."club_record_group_code",
    "after_group_code" "public"."club_record_group_code",
    "changed_by" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_record_ranking_audits_after_ranking_position_check" CHECK (("after_ranking_position" >= 1))
);


ALTER TABLE "public"."club_record_ranking_audits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_record_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "group_a_percent" integer DEFAULT 20 NOT NULL,
    "group_b_percent" integer DEFAULT 30 NOT NULL,
    "group_c_percent" integer DEFAULT 50 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_record_settings_check" CHECK (((("group_a_percent" + "group_b_percent") + "group_c_percent") = 100)),
    CONSTRAINT "club_record_settings_group_a_percent_check" CHECK (("group_a_percent" >= 0)),
    CONSTRAINT "club_record_settings_group_b_percent_check" CHECK (("group_b_percent" >= 0)),
    CONSTRAINT "club_record_settings_group_c_percent_check" CHECK (("group_c_percent" >= 0))
);


ALTER TABLE "public"."club_record_settings" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."club_record_event_participants"
    ADD CONSTRAINT "club_record_event_participants_event_id_club_member_id_key" UNIQUE ("event_id", "club_member_id");



ALTER TABLE ONLY "public"."club_record_event_participants"
    ADD CONSTRAINT "club_record_event_participants_event_id_guest_profile_id_key" UNIQUE ("event_id", "guest_profile_id");



ALTER TABLE ONLY "public"."club_record_event_participants"
    ADD CONSTRAINT "club_record_event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_event_slots"
    ADD CONSTRAINT "club_record_event_slots_event_id_court_number_slot_order_key" UNIQUE ("event_id", "court_number", "slot_order");



ALTER TABLE ONLY "public"."club_record_event_slots"
    ADD CONSTRAINT "club_record_event_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_events"
    ADD CONSTRAINT "club_record_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_guest_invites"
    ADD CONSTRAINT "club_record_guest_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."club_record_guest_invites"
    ADD CONSTRAINT "club_record_guest_invites_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."club_record_guest_invites"
    ADD CONSTRAINT "club_record_guest_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_guest_profiles"
    ADD CONSTRAINT "club_record_guest_profiles_club_id_guest_user_id_key" UNIQUE ("club_id", "guest_user_id");



ALTER TABLE ONLY "public"."club_record_guest_profiles"
    ADD CONSTRAINT "club_record_guest_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_match_players"
    ADD CONSTRAINT "club_record_match_players_match_id_participant_id_key" UNIQUE ("match_id", "participant_id");



ALTER TABLE ONLY "public"."club_record_match_players"
    ADD CONSTRAINT "club_record_match_players_match_id_side_position_key" UNIQUE ("match_id", "side", "position");



ALTER TABLE ONLY "public"."club_record_match_players"
    ADD CONSTRAINT "club_record_match_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_match_results"
    ADD CONSTRAINT "club_record_match_results_match_id_key" UNIQUE ("match_id");



ALTER TABLE ONLY "public"."club_record_match_results"
    ADD CONSTRAINT "club_record_match_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_matches"
    ADD CONSTRAINT "club_record_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_matches"
    ADD CONSTRAINT "club_record_matches_slot_id_key" UNIQUE ("slot_id");



ALTER TABLE ONLY "public"."club_record_members"
    ADD CONSTRAINT "club_record_members_club_id_ranking_position_key" UNIQUE ("club_id", "ranking_position");



ALTER TABLE ONLY "public"."club_record_members"
    ADD CONSTRAINT "club_record_members_club_member_id_key" UNIQUE ("club_member_id");



ALTER TABLE ONLY "public"."club_record_members"
    ADD CONSTRAINT "club_record_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_ranking_audits"
    ADD CONSTRAINT "club_record_ranking_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_record_settings"
    ADD CONSTRAINT "club_record_settings_club_id_key" UNIQUE ("club_id");



ALTER TABLE ONLY "public"."club_record_settings"
    ADD CONSTRAINT "club_record_settings_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "club_record_event_participants_event_arrival_idx" ON "public"."club_record_event_participants" USING "btree" ("event_id", "arrival_time");



CREATE INDEX "club_record_event_participants_event_type_idx" ON "public"."club_record_event_participants" USING "btree" ("event_id", "participant_type");



CREATE INDEX "club_record_event_slots_event_starts_at_idx" ON "public"."club_record_event_slots" USING "btree" ("event_id", "starts_at");



CREATE INDEX "club_record_events_club_date_idx" ON "public"."club_record_events" USING "btree" ("club_id", "event_date");



CREATE INDEX "club_record_events_club_status_idx" ON "public"."club_record_events" USING "btree" ("club_id", "status");



CREATE INDEX "club_record_events_visible_idx" ON "public"."club_record_events" USING "btree" ("club_id", "is_deleted", "event_date" DESC);



CREATE INDEX "club_record_match_players_participant_idx" ON "public"."club_record_match_players" USING "btree" ("participant_id");



CREATE INDEX "club_record_matches_event_status_idx" ON "public"."club_record_matches" USING "btree" ("event_id", "status");



CREATE INDEX "club_record_members_club_group_idx" ON "public"."club_record_members" USING "btree" ("club_id", "group_code");



CREATE INDEX "club_record_members_club_ranking_idx" ON "public"."club_record_members" USING "btree" ("club_id", "ranking_position");



CREATE INDEX "club_record_ranking_audits_club_created_idx" ON "public"."club_record_ranking_audits" USING "btree" ("club_id", "created_at" DESC);



CREATE INDEX "club_record_ranking_audits_target_created_idx" ON "public"."club_record_ranking_audits" USING "btree" ("target_club_member_id", "created_at" DESC);



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



CREATE OR REPLACE TRIGGER "club_record_event_participants_assignment_dirty_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."club_record_event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_club_record_assignment_dirty_sync"();



CREATE OR REPLACE TRIGGER "club_record_event_participants_prevent_linked_delete" BEFORE DELETE ON "public"."club_record_event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_club_record_linked_participant_delete"();



CREATE OR REPLACE TRIGGER "club_record_event_participants_progress_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."club_record_event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_club_record_progress_sync"();



CREATE OR REPLACE TRIGGER "club_record_event_participants_set_updated_at" BEFORE UPDATE ON "public"."club_record_event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "club_record_event_participants_stats_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."club_record_event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_club_record_event_participant_stats_sync"();



CREATE OR REPLACE TRIGGER "club_record_event_participants_validate" BEFORE INSERT OR UPDATE ON "public"."club_record_event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."validate_club_record_event_participant"();



CREATE OR REPLACE TRIGGER "club_record_event_slots_set_updated_at" BEFORE UPDATE ON "public"."club_record_event_slots" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "club_record_events_prevent_confirmed_cancel" BEFORE UPDATE ON "public"."club_record_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_club_record_confirmed_event_cancel"();



CREATE OR REPLACE TRIGGER "club_record_events_set_updated_at" BEFORE UPDATE ON "public"."club_record_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "club_record_events_soft_delete_stats_sync" AFTER UPDATE ON "public"."club_record_events" FOR EACH ROW EXECUTE FUNCTION "public"."handle_club_record_event_soft_delete_stats_sync"();



CREATE OR REPLACE TRIGGER "club_record_guest_invites_set_updated_at" BEFORE UPDATE ON "public"."club_record_guest_invites" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "club_record_guest_profiles_set_updated_at" BEFORE UPDATE ON "public"."club_record_guest_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "club_record_match_results_set_updated_at" BEFORE UPDATE ON "public"."club_record_match_results" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "club_record_matches_prevent_confirmed_delete" BEFORE DELETE ON "public"."club_record_matches" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_club_record_confirmed_match_delete"();



CREATE OR REPLACE TRIGGER "club_record_matches_progress_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."club_record_matches" FOR EACH ROW EXECUTE FUNCTION "public"."handle_club_record_progress_sync"();



CREATE OR REPLACE TRIGGER "club_record_matches_set_updated_at" BEFORE UPDATE ON "public"."club_record_matches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "club_record_matches_stats_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."club_record_matches" FOR EACH ROW EXECUTE FUNCTION "public"."handle_club_record_match_stats_sync"();



CREATE OR REPLACE TRIGGER "club_record_members_set_updated_at" BEFORE UPDATE ON "public"."club_record_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "club_record_settings_set_updated_at" BEFORE UPDATE ON "public"."club_record_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



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



ALTER TABLE ONLY "public"."club_record_event_participants"
    ADD CONSTRAINT "club_record_event_participants_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_event_participants"
    ADD CONSTRAINT "club_record_event_participants_club_member_id_fkey" FOREIGN KEY ("club_member_id") REFERENCES "public"."club_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_event_participants"
    ADD CONSTRAINT "club_record_event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."club_record_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_event_participants"
    ADD CONSTRAINT "club_record_event_participants_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "public"."club_record_guest_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_event_slots"
    ADD CONSTRAINT "club_record_event_slots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."club_record_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_events"
    ADD CONSTRAINT "club_record_events_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_events"
    ADD CONSTRAINT "club_record_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_events"
    ADD CONSTRAINT "club_record_events_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_guest_invites"
    ADD CONSTRAINT "club_record_guest_invites_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_guest_invites"
    ADD CONSTRAINT "club_record_guest_invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."club_record_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_guest_invites"
    ADD CONSTRAINT "club_record_guest_invites_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_guest_profiles"
    ADD CONSTRAINT "club_record_guest_profiles_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_guest_profiles"
    ADD CONSTRAINT "club_record_guest_profiles_guest_user_id_fkey" FOREIGN KEY ("guest_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_guest_profiles"
    ADD CONSTRAINT "club_record_guest_profiles_linked_club_member_id_fkey" FOREIGN KEY ("linked_club_member_id") REFERENCES "public"."club_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_record_match_players"
    ADD CONSTRAINT "club_record_match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."club_record_matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_match_players"
    ADD CONSTRAINT "club_record_match_players_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."club_record_event_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_match_results"
    ADD CONSTRAINT "club_record_match_results_entered_by_participant_id_fkey" FOREIGN KEY ("entered_by_participant_id") REFERENCES "public"."club_record_event_participants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_match_results"
    ADD CONSTRAINT "club_record_match_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."club_record_matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_matches"
    ADD CONSTRAINT "club_record_matches_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_matches"
    ADD CONSTRAINT "club_record_matches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_matches"
    ADD CONSTRAINT "club_record_matches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."club_record_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_matches"
    ADD CONSTRAINT "club_record_matches_result_entered_by_fkey" FOREIGN KEY ("result_entered_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_matches"
    ADD CONSTRAINT "club_record_matches_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."club_record_event_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_matches"
    ADD CONSTRAINT "club_record_matches_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_members"
    ADD CONSTRAINT "club_record_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_members"
    ADD CONSTRAINT "club_record_members_club_member_id_fkey" FOREIGN KEY ("club_member_id") REFERENCES "public"."club_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_ranking_audits"
    ADD CONSTRAINT "club_record_ranking_audits_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."club_record_ranking_audits"
    ADD CONSTRAINT "club_record_ranking_audits_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_ranking_audits"
    ADD CONSTRAINT "club_record_ranking_audits_target_club_member_id_fkey" FOREIGN KEY ("target_club_member_id") REFERENCES "public"."club_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_record_settings"
    ADD CONSTRAINT "club_record_settings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



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



ALTER TABLE "public"."club_record_event_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_event_participants_admin_all" ON "public"."club_record_event_participants" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_record_events" "e"
  WHERE (("e"."id" = "club_record_event_participants"."event_id") AND "public"."is_club_admin"("e"."club_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."club_record_events" "e"
  WHERE (("e"."id" = "club_record_event_participants"."event_id") AND "public"."is_club_admin"("e"."club_id")))));



ALTER TABLE "public"."club_record_event_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_event_slots_admin_all" ON "public"."club_record_event_slots" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_record_events" "e"
  WHERE (("e"."id" = "club_record_event_slots"."event_id") AND "public"."is_club_admin"("e"."club_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."club_record_events" "e"
  WHERE (("e"."id" = "club_record_event_slots"."event_id") AND "public"."is_club_admin"("e"."club_id")))));



CREATE POLICY "club_record_event_slots_participant_select" ON "public"."club_record_event_slots" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_record_events" "e"
  WHERE (("e"."id" = "club_record_event_slots"."event_id") AND ("e"."is_deleted" = false) AND ("e"."status" <> 'cancelled'::"public"."club_record_event_status") AND "public"."is_club_record_event_participant"("e"."id")))));



ALTER TABLE "public"."club_record_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_events_admin_all" ON "public"."club_record_events" TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "club_record_events_participant_select" ON "public"."club_record_events" FOR SELECT TO "authenticated" USING ((("is_deleted" = false) AND ("status" <> 'cancelled'::"public"."club_record_event_status") AND "public"."is_club_record_event_participant"("id")));



ALTER TABLE "public"."club_record_guest_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_guest_invites_admin_all" ON "public"."club_record_guest_invites" TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



ALTER TABLE "public"."club_record_guest_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_guest_profiles_admin_all" ON "public"."club_record_guest_profiles" TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



ALTER TABLE "public"."club_record_match_players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_match_players_admin_all" ON "public"."club_record_match_players" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."club_record_matches" "m"
     JOIN "public"."club_record_events" "e" ON (("e"."id" = "m"."event_id")))
  WHERE (("m"."id" = "club_record_match_players"."match_id") AND "public"."is_club_admin"("e"."club_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."club_record_matches" "m"
     JOIN "public"."club_record_events" "e" ON (("e"."id" = "m"."event_id")))
  WHERE (("m"."id" = "club_record_match_players"."match_id") AND "public"."is_club_admin"("e"."club_id")))));



ALTER TABLE "public"."club_record_match_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_match_results_admin_all" ON "public"."club_record_match_results" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."club_record_matches" "m"
     JOIN "public"."club_record_events" "e" ON (("e"."id" = "m"."event_id")))
  WHERE (("m"."id" = "club_record_match_results"."match_id") AND "public"."is_club_admin"("e"."club_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."club_record_matches" "m"
     JOIN "public"."club_record_events" "e" ON (("e"."id" = "m"."event_id")))
  WHERE (("m"."id" = "club_record_match_results"."match_id") AND "public"."is_club_admin"("e"."club_id")))));



CREATE POLICY "club_record_match_results_member_insert" ON "public"."club_record_match_results" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_submit_club_record_result"("match_id") AND "public"."is_club_record_match_player_participant"("match_id", "entered_by_participant_id") AND (EXISTS ( SELECT 1
   FROM ("public"."club_record_event_participants" "ep"
     JOIN "public"."club_members" "cm" ON (("cm"."id" = "ep"."club_member_id")))
  WHERE (("ep"."id" = "club_record_match_results"."entered_by_participant_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."is_active" = true))))));



CREATE POLICY "club_record_match_results_participant_select" ON "public"."club_record_match_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."club_record_matches" "m"
     JOIN "public"."club_record_events" "e" ON (("e"."id" = "m"."event_id")))
  WHERE (("m"."id" = "club_record_match_results"."match_id") AND ("m"."status" <> 'cancelled'::"public"."club_record_match_status") AND ("e"."is_deleted" = false) AND ("e"."status" <> 'cancelled'::"public"."club_record_event_status") AND "public"."is_club_record_match_participant"("m"."id")))));



ALTER TABLE "public"."club_record_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_matches_admin_all" ON "public"."club_record_matches" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_record_events" "e"
  WHERE (("e"."id" = "club_record_matches"."event_id") AND "public"."is_club_admin"("e"."club_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."club_record_events" "e"
  WHERE (("e"."id" = "club_record_matches"."event_id") AND "public"."is_club_admin"("e"."club_id")))));



CREATE POLICY "club_record_matches_participant_select" ON "public"."club_record_matches" FOR SELECT TO "authenticated" USING ((("status" <> 'cancelled'::"public"."club_record_match_status") AND (EXISTS ( SELECT 1
   FROM "public"."club_record_events" "e"
  WHERE (("e"."id" = "club_record_matches"."event_id") AND ("e"."is_deleted" = false) AND ("e"."status" <> 'cancelled'::"public"."club_record_event_status")))) AND "public"."is_club_record_match_participant"("id")));



ALTER TABLE "public"."club_record_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_members_admin_all" ON "public"."club_record_members" TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



ALTER TABLE "public"."club_record_ranking_audits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_ranking_audits_admin_insert" ON "public"."club_record_ranking_audits" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "club_record_ranking_audits_admin_select_insert" ON "public"."club_record_ranking_audits" FOR SELECT TO "authenticated" USING ("public"."is_club_admin"("club_id"));



ALTER TABLE "public"."club_record_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_record_settings_admin_all" ON "public"."club_record_settings" TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



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



GRANT ALL ON FUNCTION "public"."apply_club_record_auto_assignments"("p_event_id" "uuid", "p_plans" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_club_record_auto_assignments"("p_event_id" "uuid", "p_plans" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_club_record_auto_assignments"("p_event_id" "uuid", "p_plans" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_create_match_schedule"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_create_match_schedule"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_create_match_schedule"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_match"("p_club_id" "uuid", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_match"("p_club_id" "uuid", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_match"("p_club_id" "uuid", "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_submit_club_record_result"("p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_submit_club_record_result"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_submit_club_record_result"("p_match_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_expired_club_record_matches"() TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_expired_club_record_matches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_expired_club_record_matches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_match_schedule_request"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_match_schedule_request"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_match_schedule_request"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_club_record_manual_match"("p_event_id" "uuid", "p_slot_id" "uuid", "p_players" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_club_record_manual_match"("p_event_id" "uuid", "p_slot_id" "uuid", "p_players" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_club_record_manual_match"("p_event_id" "uuid", "p_slot_id" "uuid", "p_players" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_match_schedule"("p_club_id" "uuid", "p_format" "public"."match_schedule_format", "p_scheduled_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_court_fee" integer, "p_ball_fee" integer, "p_capacity" integer, "p_notes" "text", "p_include_host" boolean, "p_join_policy" "public"."match_schedule_join_policy") TO "anon";
GRANT ALL ON FUNCTION "public"."create_match_schedule"("p_club_id" "uuid", "p_format" "public"."match_schedule_format", "p_scheduled_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_court_fee" integer, "p_ball_fee" integer, "p_capacity" integer, "p_notes" "text", "p_include_host" boolean, "p_join_policy" "public"."match_schedule_join_policy") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_match_schedule"("p_club_id" "uuid", "p_format" "public"."match_schedule_format", "p_scheduled_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_court_fee" integer, "p_ball_fee" integer, "p_capacity" integer, "p_notes" "text", "p_include_host" boolean, "p_join_policy" "public"."match_schedule_join_policy") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_club_record_match"("p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_club_record_match"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_club_record_match"("p_match_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code_unique"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_code_unique"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_code_unique"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_club_record_event_participants"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_club_record_event_participants"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_club_record_event_participants"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_club_record_event_slots_overview"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_club_record_event_slots_overview"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_club_record_event_slots_overview"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_club_record_member_history"("p_club_id" "uuid", "p_target_club_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_club_record_member_history"("p_club_id" "uuid", "p_target_club_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_club_record_member_history"("p_club_id" "uuid", "p_target_club_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_club_record_monthly_public_card"("p_club_id" "uuid", "p_month_start" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_club_record_monthly_public_card"("p_club_id" "uuid", "p_month_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_club_record_monthly_public_card"("p_club_id" "uuid", "p_month_start" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_active_club_member_id"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_active_club_member_id"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_active_club_member_id"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_club_record_history"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_club_record_history"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_club_record_history"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_club_record_assignment_dirty_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_club_record_assignment_dirty_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_club_record_assignment_dirty_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_club_record_event_participant_stats_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_club_record_event_participant_stats_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_club_record_event_participant_stats_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_club_record_event_soft_delete_stats_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_club_record_event_soft_delete_stats_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_club_record_event_soft_delete_stats_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_club_record_match_stats_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_club_record_match_stats_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_club_record_match_stats_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_club_record_progress_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_club_record_progress_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_club_record_progress_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_admin"("target_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_admin"("target_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_admin"("target_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_member"("target_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_member"("target_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_member"("target_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_record_event_participant"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_record_event_participant"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_record_event_participant"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_record_match_participant"("p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_record_match_participant"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_record_match_participant"("p_match_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_record_match_player_participant"("p_match_id" "uuid", "p_participant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_record_match_player_participant"("p_match_id" "uuid", "p_participant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_record_match_player_participant"("p_match_id" "uuid", "p_participant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_record_participant_occupied_at_slot_start"("p_event_id" "uuid", "p_slot_starts_at" timestamp with time zone, "p_participant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_record_participant_occupied_at_slot_start"("p_event_id" "uuid", "p_slot_starts_at" timestamp with time zone, "p_participant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_record_participant_occupied_at_slot_start"("p_event_id" "uuid", "p_slot_starts_at" timestamp with time zone, "p_participant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_club_by_invite"("p_invite_code" "text", "p_nickname" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_club_by_invite"("p_invite_code" "text", "p_nickname" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_club_by_invite"("p_invite_code" "text", "p_nickname" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_club_by_invite_as_guest"("p_invite_code" "text", "p_nickname" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_club_by_invite_as_guest"("p_invite_code" "text", "p_nickname" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_club_by_invite_as_guest"("p_invite_code" "text", "p_nickname" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_club_record_event_guest_by_invite_code"("p_code" "text", "p_display_name" "text", "p_gender" "text", "p_career_text" "text", "p_group_code" "public"."club_record_group_code", "p_arrival_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."join_club_record_event_guest_by_invite_code"("p_code" "text", "p_display_name" "text", "p_gender" "text", "p_career_text" "text", "p_group_code" "public"."club_record_group_code", "p_arrival_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_club_record_event_guest_by_invite_code"("p_code" "text", "p_display_name" "text", "p_gender" "text", "p_career_text" "text", "p_group_code" "public"."club_record_group_code", "p_arrival_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."join_match_schedule"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."join_match_schedule"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_match_schedule"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_match_schedule"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_match_schedule"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_match_schedule"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_club_record_event_assignment_dirty"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_club_record_event_assignment_dirty"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_club_record_event_assignment_dirty"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."move_club_record_ranking"("p_club_id" "uuid", "p_club_member_id" "uuid", "p_target_position" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."move_club_record_ranking"("p_club_id" "uuid", "p_club_member_id" "uuid", "p_target_position" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_club_record_ranking"("p_club_id" "uuid", "p_club_member_id" "uuid", "p_target_position" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_club_record_confirmed_event_cancel"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_club_record_confirmed_event_cancel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_club_record_confirmed_event_cancel"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_club_record_confirmed_match_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_club_record_confirmed_match_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_club_record_confirmed_match_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_club_record_linked_participant_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_club_record_linked_participant_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_club_record_linked_participant_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_club_record_groups"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_club_record_groups"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_club_record_groups"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_club_record_event_status"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_club_record_event_status"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_club_record_event_status"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_club_record_member_stats_for_club"("p_club_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_club_record_member_stats_for_club"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_club_record_member_stats_for_club"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_club_record_member_stats_for_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_club_record_member_stats_for_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_club_record_member_stats_for_event"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_club_record_progress_for_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_club_record_progress_for_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_club_record_progress_for_event"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_club_record_slot_statuses_for_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_club_record_slot_statuses_for_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_club_record_slot_statuses_for_event"("p_event_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."remove_club_record_event_participant"("p_event_id" "uuid", "p_participant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_club_record_event_participant"("p_event_id" "uuid", "p_participant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_club_record_event_participant"("p_event_id" "uuid", "p_participant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_match_schedule"("p_schedule_id" "uuid", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_match_schedule"("p_schedule_id" "uuid", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_match_schedule"("p_schedule_id" "uuid", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_club_record_members"("p_club_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_club_record_members"("p_club_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_club_record_members"("p_club_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_club_name"("p_club_id" "uuid", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_club_name"("p_club_id" "uuid", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_club_name"("p_club_id" "uuid", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_club_record_match_result"("p_match_id" "uuid", "p_score_text" "text", "p_is_draw" boolean, "p_winning_side" integer, "p_losing_side" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_club_member_settings"("p_club_id" "uuid", "p_nickname" "text", "p_open_kakao_profile" boolean, "p_allow_record_search" boolean, "p_share_history" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_club_member_settings"("p_club_id" "uuid", "p_nickname" "text", "p_open_kakao_profile" boolean, "p_allow_record_search" boolean, "p_share_history" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_club_member_settings"("p_club_id" "uuid", "p_nickname" "text", "p_open_kakao_profile" boolean, "p_allow_record_search" boolean, "p_share_history" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_club_nickname"("p_club_id" "uuid", "p_nickname" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_club_nickname"("p_club_id" "uuid", "p_nickname" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_club_nickname"("p_club_id" "uuid", "p_nickname" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_club_record_event_participant"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_club_record_event_participant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_club_record_event_participant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_club_record_guest_invite_code"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_club_record_guest_invite_code"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_club_record_guest_invite_code"("p_code" "text") TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."club_members" TO "anon";
GRANT ALL ON TABLE "public"."club_members" TO "authenticated";
GRANT ALL ON TABLE "public"."club_members" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_event_participants" TO "anon";
GRANT ALL ON TABLE "public"."club_record_event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_event_slots" TO "anon";
GRANT ALL ON TABLE "public"."club_record_event_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_event_slots" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_events" TO "anon";
GRANT ALL ON TABLE "public"."club_record_events" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_events" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_guest_invites" TO "anon";
GRANT ALL ON TABLE "public"."club_record_guest_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_guest_invites" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_guest_profiles" TO "anon";
GRANT ALL ON TABLE "public"."club_record_guest_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_guest_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_match_players" TO "anon";
GRANT ALL ON TABLE "public"."club_record_match_players" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_match_players" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_match_results" TO "anon";
GRANT ALL ON TABLE "public"."club_record_match_results" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_match_results" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_matches" TO "anon";
GRANT ALL ON TABLE "public"."club_record_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_matches" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_members" TO "anon";
GRANT ALL ON TABLE "public"."club_record_members" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_members" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_ranking_audits" TO "anon";
GRANT ALL ON TABLE "public"."club_record_ranking_audits" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_ranking_audits" TO "service_role";



GRANT ALL ON TABLE "public"."club_record_settings" TO "anon";
GRANT ALL ON TABLE "public"."club_record_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."club_record_settings" TO "service_role";



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







