create or replace function public.join_club_by_invite(
  p_invite_code text,
  p_nickname text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
  limit 1;

  if v_club_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.club_members (club_id, user_id, role, nickname)
  values (v_club_id, v_user_id, 'member', trim(p_nickname))
  on conflict (club_id, user_id)
  do update set nickname = excluded.nickname;

  return v_club_id;
end;
$$;

grant execute on function public.join_club_by_invite(text, text) to authenticated;

-- Make PostgREST pick up function changes immediately.
notify pgrst, 'reload schema';
