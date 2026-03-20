create or replace function public.create_match_schedule(
  p_club_id uuid,
  p_format public.match_schedule_format,
  p_scheduled_at timestamptz,
  p_location text,
  p_court_fee integer default 0,
  p_ball_fee integer default 0,
  p_capacity integer default 4,
  p_notes text default '',
  p_include_host boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
  limit 1;

  if v_host_member_id is null then
    raise exception '클럽 멤버만 일정을 생성할 수 있습니다.';
  end if;

  if not public.can_create_match_schedule(p_club_id) then
    raise exception '게스트는 일정을 생성할 수 없습니다.';
  end if;

  insert into public.match_schedules (
    club_id,
    host_member_id,
    created_by,
    format,
    status,
    scheduled_at,
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
    p_scheduled_at,
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

grant execute on function public.create_match_schedule(
  uuid,
  public.match_schedule_format,
  timestamptz,
  text,
  integer,
  integer,
  integer,
  text,
  boolean
) to authenticated;
