-- P1-B: "내 다음 경기" dashboard card.
--
-- Members want to know at a glance from the club home: which court do I
-- go to next, with whom, and when? Currently they have to drill into the
-- event workspace to find their own slot.
--
-- get_my_next_club_record_match(p_club_id) returns at most one row —
-- the soonest upcoming pending_result match the caller is in, with
-- slot time, court number, the caller's side, and both team rosters
-- (members render via club_members.nickname, guests via
-- club_record_guest_profiles.display_name).
--
-- Time predicate: slot ends_at > now(), so a still-in-progress match
-- is shown until its slot ends. Excludes deleted/cancelled events.

create or replace function public.get_my_next_club_record_match(
  p_club_id uuid
)
returns table (
  match_id uuid,
  event_id uuid,
  event_title text,
  slot_starts_at timestamptz,
  slot_ends_at timestamptz,
  court_number integer,
  my_side integer,
  team_one_names text[],
  team_two_names text[]
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with my_member as (
    select public.get_my_active_club_member_id(p_club_id) as club_member_id
  ),
  my_next_match as (
    select
      m.id as match_id,
      m.event_id,
      m.slot_id,
      mp.side as my_side,
      s.starts_at,
      s.ends_at,
      s.court_number,
      e.title as event_title
    from my_member me
    join public.club_record_event_participants ep
      on ep.club_member_id = me.club_member_id
    join public.club_record_match_players mp
      on mp.participant_id = ep.id
    join public.club_record_matches m
      on m.id = mp.match_id
    join public.club_record_event_slots s
      on s.id = m.slot_id
    join public.club_record_events e
      on e.id = m.event_id
    where e.club_id = p_club_id
      and e.is_deleted = false
      and e.status <> 'cancelled'
      and m.status = 'pending_result'
      and s.ends_at > now()
    order by s.starts_at asc
    limit 1
  )
  select
    nm.match_id,
    nm.event_id,
    nm.event_title,
    nm.starts_at as slot_starts_at,
    nm.ends_at as slot_ends_at,
    nm.court_number,
    nm.my_side,
    (
      select coalesce(
        array_agg(
          coalesce(cm.nickname, gp.display_name, '?')
          order by mp_team.position
        ),
        array[]::text[]
      )
      from public.club_record_match_players mp_team
      join public.club_record_event_participants ep_team
        on ep_team.id = mp_team.participant_id
      left join public.club_members cm
        on cm.id = ep_team.club_member_id
      left join public.club_record_guest_profiles gp
        on gp.id = ep_team.guest_profile_id
      where mp_team.match_id = nm.match_id
        and mp_team.side = 1
    ) as team_one_names,
    (
      select coalesce(
        array_agg(
          coalesce(cm.nickname, gp.display_name, '?')
          order by mp_team.position
        ),
        array[]::text[]
      )
      from public.club_record_match_players mp_team
      join public.club_record_event_participants ep_team
        on ep_team.id = mp_team.participant_id
      left join public.club_members cm
        on cm.id = ep_team.club_member_id
      left join public.club_record_guest_profiles gp
        on gp.id = ep_team.guest_profile_id
      where mp_team.match_id = nm.match_id
        and mp_team.side = 2
    ) as team_two_names
  from my_next_match nm;
$$;

alter function public.get_my_next_club_record_match(uuid)
  owner to postgres;

grant execute on function public.get_my_next_club_record_match(uuid)
  to authenticated;
