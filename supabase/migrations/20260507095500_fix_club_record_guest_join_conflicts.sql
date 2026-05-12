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
