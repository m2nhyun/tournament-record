create or replace function public.get_my_active_club_member_id(
  p_club_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.id
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.user_id = auth.uid()
    and cm.is_active = true
  limit 1;
$$;

create or replace function public.recalculate_club_record_groups(
  p_club_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.move_club_record_ranking(
  p_club_id uuid,
  p_club_member_id uuid,
  p_target_position integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_current_position integer;
  v_max_position integer;
  v_target_position integer;
  v_temp_position integer;
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

  v_temp_position := v_max_position + 1;

  update public.club_record_members
  set ranking_position = v_temp_position
  where club_id = p_club_id
    and club_member_id = p_club_member_id;

  if v_target_position < v_current_position then
    update public.club_record_members
    set ranking_position = ranking_position + 1
    where club_id = p_club_id
      and ranking_position >= v_target_position
      and ranking_position < v_current_position;
  else
    update public.club_record_members
    set ranking_position = ranking_position - 1
    where club_id = p_club_id
      and ranking_position <= v_target_position
      and ranking_position > v_current_position;
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

create or replace function public.is_club_record_event_participant(
  p_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.is_club_record_match_participant(
  p_match_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.can_submit_club_record_result(
  p_match_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.is_club_record_match_player_participant(
  p_match_id uuid,
  p_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_record_match_players mp
    where mp.match_id = p_match_id
      and mp.participant_id = p_participant_id
  );
$$;

create or replace function public.is_club_record_participant_occupied_at_slot_start(
  p_event_id uuid,
  p_slot_starts_at timestamptz,
  p_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.cancel_expired_club_record_matches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.refresh_club_record_member_stats_for_club(
  p_club_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
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

create or replace function public.refresh_club_record_member_stats_for_event(
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.handle_club_record_event_participant_stats_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_club_record_member_stats_for_event(
    coalesce(new.event_id, old.event_id)
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.handle_club_record_match_stats_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_club_record_member_stats_for_event(
    coalesce(new.event_id, old.event_id)
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.handle_club_record_event_soft_delete_stats_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_deleted is distinct from old.is_deleted then
    perform public.refresh_club_record_member_stats_for_event(new.id);
  end if;

  return new;
end;
$$;

create or replace function public.refresh_club_record_slot_statuses_for_event(
  p_event_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
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

create or replace function public.refresh_club_record_event_status(
  p_event_id uuid
)
returns public.club_record_event_status
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.refresh_club_record_progress_for_event(
  p_event_id uuid
)
returns public.club_record_event_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.club_record_event_status;
begin
  perform public.refresh_club_record_slot_statuses_for_event(p_event_id);
  v_status := public.refresh_club_record_event_status(p_event_id);
  return v_status;
end;
$$;

create or replace function public.mark_club_record_event_assignment_dirty(
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.club_record_events e
  set assignment_dirty = true
  where e.id = p_event_id
    and e.is_deleted = false
    and e.assignment_dirty = false;
end;
$$;

create or replace function public.handle_club_record_progress_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_club_record_progress_for_event(
    coalesce(new.event_id, old.event_id)
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.handle_club_record_assignment_dirty_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mark_club_record_event_assignment_dirty(
    coalesce(new.event_id, old.event_id)
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_club_record_confirmed_match_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'confirmed' then
    raise exception '확정된 club record 경기는 삭제할 수 없습니다.';
  end if;

  return old;
end;
$$;

create or replace function public.prevent_club_record_linked_participant_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.prevent_club_record_confirmed_event_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.validate_club_record_event_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.verify_club_record_guest_invite_code(
  p_code text
)
returns table (
  event_id uuid,
  club_id uuid,
  event_date date,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.join_club_record_event_guest_by_invite_code(
  p_code text,
  p_display_name text,
  p_gender text default null,
  p_career_text text default null,
  p_group_code public.club_record_group_code default null,
  p_arrival_time timestamptz default null
)
returns table (
  event_id uuid,
  club_id uuid,
  event_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  guest_profile_id uuid,
  guest_user_id uuid,
  display_name text,
  gender text,
  career_text text,
  group_code public.club_record_group_code,
  linked_club_member_id uuid,
  participant_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
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
  on conflict (club_id, guest_user_id) do update
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
  on conflict (event_id, guest_profile_id) do update
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

create or replace function public.get_club_record_event_participants(
  p_event_id uuid
)
returns table (
  id uuid,
  event_id uuid,
  participant_type public.club_record_participant_type,
  club_member_id uuid,
  guest_profile_id uuid,
  display_name text,
  arrival_time timestamptz,
  attendance_status public.club_record_attendance_status,
  group_code public.club_record_group_code,
  ranking_position integer
)
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.get_club_record_event_slots_overview(
  p_event_id uuid
)
returns table (
  id uuid,
  event_id uuid,
  court_number integer,
  slot_order integer,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.club_record_slot_status,
  is_locked boolean,
  match_id uuid,
  match_status public.club_record_match_status,
  assignment_mode text,
  is_manual boolean,
  confirmed_at timestamptz,
  score_text text,
  player_participant_id uuid,
  player_display_name text,
  player_side integer,
  player_position integer
)
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.remove_club_record_event_participant(
  p_event_id uuid,
  p_participant_id uuid
)
returns table (
  deleted_match_count integer,
  released_slot_count integer
)
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.apply_club_record_auto_assignments(
  p_event_id uuid,
  p_plans jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.create_club_record_manual_match(
  p_event_id uuid,
  p_slot_id uuid,
  p_players jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.delete_club_record_match(
  p_match_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.submit_club_record_match_result(
  p_match_id uuid,
  p_score_text text,
  p_is_draw boolean,
  p_winning_side integer,
  p_losing_side integer
)
returns table (
  match_id uuid,
  score_text text,
  is_draw boolean,
  winning_side integer,
  losing_side integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.update_club_record_match_result(
  p_match_id uuid,
  p_score_text text,
  p_is_draw boolean,
  p_winning_side integer,
  p_losing_side integer
)
returns table (
  match_id uuid,
  score_text text,
  is_draw boolean,
  winning_side integer,
  losing_side integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
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
  on conflict (match_id) do update
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

drop trigger if exists club_record_event_participants_stats_sync on public.club_record_event_participants;
create trigger club_record_event_participants_stats_sync
after insert or update or delete on public.club_record_event_participants
for each row execute function public.handle_club_record_event_participant_stats_sync();

drop trigger if exists club_record_matches_stats_sync on public.club_record_matches;
create trigger club_record_matches_stats_sync
after insert or update or delete on public.club_record_matches
for each row execute function public.handle_club_record_match_stats_sync();

drop trigger if exists club_record_events_soft_delete_stats_sync on public.club_record_events;
create trigger club_record_events_soft_delete_stats_sync
after update on public.club_record_events
for each row execute function public.handle_club_record_event_soft_delete_stats_sync();

drop trigger if exists club_record_event_participants_progress_sync on public.club_record_event_participants;
create trigger club_record_event_participants_progress_sync
after insert or update or delete on public.club_record_event_participants
for each row execute function public.handle_club_record_progress_sync();

drop trigger if exists club_record_event_participants_assignment_dirty_sync on public.club_record_event_participants;
create trigger club_record_event_participants_assignment_dirty_sync
after insert or update or delete on public.club_record_event_participants
for each row execute function public.handle_club_record_assignment_dirty_sync();

drop trigger if exists club_record_event_participants_validate on public.club_record_event_participants;
create trigger club_record_event_participants_validate
before insert or update on public.club_record_event_participants
for each row execute function public.validate_club_record_event_participant();

drop trigger if exists club_record_event_participants_prevent_linked_delete on public.club_record_event_participants;
create trigger club_record_event_participants_prevent_linked_delete
before delete on public.club_record_event_participants
for each row execute function public.prevent_club_record_linked_participant_delete();

drop trigger if exists club_record_events_prevent_confirmed_cancel on public.club_record_events;
create trigger club_record_events_prevent_confirmed_cancel
before update on public.club_record_events
for each row execute function public.prevent_club_record_confirmed_event_cancel();

drop trigger if exists club_record_matches_prevent_confirmed_delete on public.club_record_matches;
create trigger club_record_matches_prevent_confirmed_delete
before delete on public.club_record_matches
for each row execute function public.prevent_club_record_confirmed_match_delete();

drop trigger if exists club_record_matches_progress_sync on public.club_record_matches;
create trigger club_record_matches_progress_sync
after insert or update or delete on public.club_record_matches
for each row execute function public.handle_club_record_progress_sync();

create or replace function public.get_club_record_monthly_public_card(
  p_club_id uuid,
  p_month_start date
)
returns table (
  club_member_id uuid,
  nickname text,
  wins integer,
  losses integer,
  draws integer,
  win_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.get_my_club_record_history(
  p_club_id uuid
)
returns table (
  match_id uuid,
  event_id uuid,
  event_date date,
  score_text text,
  result text,
  partner_names text[],
  opponent_names text[]
)
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.get_club_record_member_history(
  p_club_id uuid,
  p_target_club_member_id uuid
)
returns table (
  match_id uuid,
  event_id uuid,
  event_date date,
  score_text text,
  result text,
  partner_names text[],
  opponent_names text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
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

alter table public.club_record_settings enable row level security;
alter table public.club_record_members enable row level security;
alter table public.club_record_guest_profiles enable row level security;
alter table public.club_record_ranking_audits enable row level security;
alter table public.club_record_events enable row level security;
alter table public.club_record_guest_invites enable row level security;
alter table public.club_record_event_participants enable row level security;
alter table public.club_record_event_slots enable row level security;
alter table public.club_record_matches enable row level security;
alter table public.club_record_match_players enable row level security;
alter table public.club_record_match_results enable row level security;

drop policy if exists club_record_settings_admin_all on public.club_record_settings;
create policy club_record_settings_admin_all
on public.club_record_settings for all
to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists club_record_members_admin_all on public.club_record_members;
create policy club_record_members_admin_all
on public.club_record_members for all
to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists club_record_guest_profiles_admin_all on public.club_record_guest_profiles;
create policy club_record_guest_profiles_admin_all
on public.club_record_guest_profiles for all
to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists club_record_ranking_audits_admin_select_insert on public.club_record_ranking_audits;
create policy club_record_ranking_audits_admin_select_insert
on public.club_record_ranking_audits for select
to authenticated
using (public.is_club_admin(club_id));

drop policy if exists club_record_ranking_audits_admin_insert on public.club_record_ranking_audits;
create policy club_record_ranking_audits_admin_insert
on public.club_record_ranking_audits for insert
to authenticated
with check (public.is_club_admin(club_id));

drop policy if exists club_record_events_admin_all on public.club_record_events;
create policy club_record_events_admin_all
on public.club_record_events for all
to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists club_record_events_participant_select on public.club_record_events;
create policy club_record_events_participant_select
on public.club_record_events for select
to authenticated
using (
  is_deleted = false
  and status <> 'cancelled'
  and public.is_club_record_event_participant(id)
);

drop policy if exists club_record_guest_invites_admin_all on public.club_record_guest_invites;
create policy club_record_guest_invites_admin_all
on public.club_record_guest_invites for all
to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists club_record_event_participants_admin_all on public.club_record_event_participants;
create policy club_record_event_participants_admin_all
on public.club_record_event_participants for all
to authenticated
using (
  exists (
    select 1
    from public.club_record_events e
    where e.id = event_id
      and public.is_club_admin(e.club_id)
  )
)
with check (
  exists (
    select 1
    from public.club_record_events e
    where e.id = event_id
      and public.is_club_admin(e.club_id)
  )
);

drop policy if exists club_record_event_participants_participant_select on public.club_record_event_participants;
-- 멤버/게스트의 참가자 목록 조회는 직접 table select 대신 RPC/DTO로 제한한다.

drop policy if exists club_record_event_slots_admin_all on public.club_record_event_slots;
create policy club_record_event_slots_admin_all
on public.club_record_event_slots for all
to authenticated
using (
  exists (
    select 1
    from public.club_record_events e
    where e.id = event_id
      and public.is_club_admin(e.club_id)
  )
)
with check (
  exists (
    select 1
    from public.club_record_events e
    where e.id = event_id
      and public.is_club_admin(e.club_id)
  )
);

drop policy if exists club_record_event_slots_participant_select on public.club_record_event_slots;
create policy club_record_event_slots_participant_select
on public.club_record_event_slots for select
to authenticated
using (
  exists (
    select 1
    from public.club_record_events e
    where e.id = event_id
      and e.is_deleted = false
      and e.status <> 'cancelled'
      and public.is_club_record_event_participant(e.id)
  )
);

drop policy if exists club_record_matches_admin_all on public.club_record_matches;
create policy club_record_matches_admin_all
on public.club_record_matches for all
to authenticated
using (
  exists (
    select 1
    from public.club_record_events e
    where e.id = event_id
      and public.is_club_admin(e.club_id)
  )
)
with check (
  exists (
    select 1
    from public.club_record_events e
    where e.id = event_id
      and public.is_club_admin(e.club_id)
  )
);

drop policy if exists club_record_matches_participant_select on public.club_record_matches;
create policy club_record_matches_participant_select
on public.club_record_matches for select
to authenticated
using (
  status <> 'cancelled'
  and exists (
    select 1
    from public.club_record_events e
    where e.id = event_id
      and e.is_deleted = false
      and e.status <> 'cancelled'
  )
  and public.is_club_record_match_participant(id)
);

drop policy if exists club_record_match_players_admin_all on public.club_record_match_players;
create policy club_record_match_players_admin_all
on public.club_record_match_players for all
to authenticated
using (
  exists (
    select 1
    from public.club_record_matches m
    join public.club_record_events e on e.id = m.event_id
    where m.id = match_id
      and public.is_club_admin(e.club_id)
  )
)
with check (
  exists (
    select 1
    from public.club_record_matches m
    join public.club_record_events e on e.id = m.event_id
    where m.id = match_id
      and public.is_club_admin(e.club_id)
  )
);

drop policy if exists club_record_match_players_participant_select on public.club_record_match_players;
-- 선수 구성 조회도 직접 table select보다 RPC/DTO로 제한한다.

drop policy if exists club_record_match_results_admin_all on public.club_record_match_results;
create policy club_record_match_results_admin_all
on public.club_record_match_results for all
to authenticated
using (
  exists (
    select 1
    from public.club_record_matches m
    join public.club_record_events e on e.id = m.event_id
    where m.id = match_id
      and public.is_club_admin(e.club_id)
  )
)
with check (
  exists (
    select 1
    from public.club_record_matches m
    join public.club_record_events e on e.id = m.event_id
    where m.id = match_id
      and public.is_club_admin(e.club_id)
  )
);

drop policy if exists club_record_match_results_participant_select on public.club_record_match_results;
create policy club_record_match_results_participant_select
on public.club_record_match_results for select
to authenticated
using (
  exists (
    select 1
    from public.club_record_matches m
    join public.club_record_events e
      on e.id = m.event_id
    where m.id = match_id
      and m.status <> 'cancelled'
      and e.is_deleted = false
      and e.status <> 'cancelled'
      and public.is_club_record_match_participant(m.id)
  )
);

drop policy if exists club_record_match_results_member_insert on public.club_record_match_results;
create policy club_record_match_results_member_insert
on public.club_record_match_results for insert
to authenticated
with check (
  public.can_submit_club_record_result(match_id)
  and public.is_club_record_match_player_participant(match_id, entered_by_participant_id)
  and exists (
    select 1
    from public.club_record_event_participants ep
    join public.club_members cm
      on cm.id = ep.club_member_id
    where ep.id = entered_by_participant_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
  )
);
