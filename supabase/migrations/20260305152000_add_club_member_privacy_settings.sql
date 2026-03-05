alter table public.club_members
  add column if not exists open_kakao_profile boolean not null default false,
  add column if not exists allow_record_search boolean not null default false,
  add column if not exists share_history boolean not null default false;

create or replace function public.update_my_club_member_settings(
  p_club_id uuid,
  p_nickname text,
  p_open_kakao_profile boolean,
  p_allow_record_search boolean,
  p_share_history boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.update_my_club_member_settings(uuid, text, boolean, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
