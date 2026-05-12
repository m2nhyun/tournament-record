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
