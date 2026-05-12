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
