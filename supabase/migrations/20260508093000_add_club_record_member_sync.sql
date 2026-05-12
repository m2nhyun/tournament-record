create or replace function public.sync_club_record_members(
  p_club_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.sync_club_record_members(uuid) to authenticated;
grant execute on function public.sync_club_record_members(uuid) to service_role;
