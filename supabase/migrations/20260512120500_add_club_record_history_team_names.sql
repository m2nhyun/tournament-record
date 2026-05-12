drop function if exists public.get_my_club_record_history(uuid);
drop function if exists public.get_club_record_member_history(uuid, uuid);

create or replace function public.get_my_club_record_history(
  p_club_id uuid
)
returns table (
  match_id uuid,
  event_id uuid,
  event_date date,
  score_text text,
  result text,
  team_names text[],
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
  ),
  match_player_names as (
    select
      mp.match_id,
      mp.side,
      mp.position,
      ep.club_member_id,
      coalesce(
        nullif(cm.nickname, ''),
        nullif(gp.display_name, ''),
        case when ep.participant_type = 'guest' then '게스트' else '이름 없음' end
      ) as player_name
    from public.club_record_match_players mp
    join public.club_record_event_participants ep
      on ep.id = mp.participant_id
    left join public.club_members cm
      on cm.id = ep.club_member_id
    left join public.club_record_guest_profiles gp
      on gp.id = ep.guest_profile_id
    where mp.match_id in (select my_matches.match_id from my_matches)
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
      array_agg(mpn.player_name order by
        case when mpn.club_member_id = me.club_member_id then 0 else 1 end,
        mpn.position asc
      ) filter (where mpn.side = mm.my_side),
      '{}'::text[]
    ) as team_names,
    coalesce(
      array_agg(distinct mpn.player_name)
        filter (
          where mpn.side = mm.my_side
            and mpn.club_member_id is distinct from me.club_member_id
        ),
      '{}'::text[]
    ) as partner_names,
    coalesce(
      array_agg(distinct mpn.player_name)
        filter (where mpn.side <> mm.my_side),
      '{}'::text[]
    ) as opponent_names
  from my_matches mm
  join my_member me on true
  join match_player_names mpn
    on mpn.match_id = mm.match_id
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
  team_names text[],
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
  ),
  match_player_names as (
    select
      mp.match_id,
      mp.side,
      mp.position,
      ep.club_member_id,
      coalesce(
        nullif(cm.nickname, ''),
        nullif(gp.display_name, ''),
        case when ep.participant_type = 'guest' then '게스트' else '이름 없음' end
      ) as player_name
    from public.club_record_match_players mp
    join public.club_record_event_participants ep
      on ep.id = mp.participant_id
    left join public.club_members cm
      on cm.id = ep.club_member_id
    left join public.club_record_guest_profiles gp
      on gp.id = ep.guest_profile_id
    where mp.match_id in (select target_matches.match_id from target_matches)
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
      array_agg(mpn.player_name order by
        case when mpn.club_member_id = p_target_club_member_id then 0 else 1 end,
        mpn.position asc
      ) filter (where mpn.side = tm.target_side),
      '{}'::text[]
    ) as team_names,
    coalesce(
      array_agg(distinct mpn.player_name)
        filter (
          where mpn.side = tm.target_side
            and mpn.club_member_id is distinct from p_target_club_member_id
        ),
      '{}'::text[]
    ) as partner_names,
    coalesce(
      array_agg(distinct mpn.player_name)
        filter (where mpn.side <> tm.target_side),
      '{}'::text[]
    ) as opponent_names
  from target_matches tm
  join match_player_names mpn
    on mpn.match_id = tm.match_id
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

grant all on function public.get_my_club_record_history(uuid) to anon;
grant all on function public.get_my_club_record_history(uuid) to authenticated;
grant all on function public.get_my_club_record_history(uuid) to service_role;
grant all on function public.get_club_record_member_history(uuid, uuid) to anon;
grant all on function public.get_club_record_member_history(uuid, uuid) to authenticated;
grant all on function public.get_club_record_member_history(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
