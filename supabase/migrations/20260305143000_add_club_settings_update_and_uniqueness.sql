alter table public.clubs
  drop constraint if exists clubs_name_length_check;

alter table public.clubs
  add constraint clubs_name_length_check
  check (char_length(trim(name)) between 2 and 24);

alter table public.club_members
  drop constraint if exists club_members_nickname_length_check;

alter table public.club_members
  add constraint club_members_nickname_length_check
  check (char_length(trim(nickname)) between 2 and 24);

create unique index if not exists idx_clubs_name_normalized_unique
  on public.clubs ((lower(trim(name))));

create unique index if not exists idx_club_members_nickname_normalized_unique
  on public.club_members (club_id, (lower(trim(nickname))));

create or replace function public.update_club_name(
  p_club_id uuid,
  p_name text
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
      and role = 'owner'
  ) then
    raise exception 'Only owner can update club name';
  end if;

  update public.clubs
  set name = trim(p_name)
  where id = p_club_id;
end;
$$;

grant execute on function public.update_club_name(uuid, text) to authenticated;

create or replace function public.update_my_club_nickname(
  p_club_id uuid,
  p_nickname text
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
  set nickname = trim(p_nickname)
  where club_id = p_club_id
    and user_id = v_user_id;
end;
$$;

grant execute on function public.update_my_club_nickname(uuid, text) to authenticated;

notify pgrst, 'reload schema';
