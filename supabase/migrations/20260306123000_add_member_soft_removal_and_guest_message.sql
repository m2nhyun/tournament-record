alter table public.club_members
  add column if not exists is_active boolean not null default true,
  add column if not exists left_at timestamptz;

create or replace function public.is_club_member(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.club_members cm
    where cm.club_id = target_club_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
  );
$$;

create or replace function public.is_club_admin(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.club_members cm
    where cm.club_id = target_club_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.role in ('owner', 'manager')
  );
$$;

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
    and invite_expires_at > now()
  limit 1;

  if v_club_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.club_members (club_id, user_id, role, nickname, is_active, left_at)
  values (v_club_id, v_user_id, 'member', trim(p_nickname), true, null)
  on conflict (club_id, user_id)
  do update
    set nickname = excluded.nickname,
        is_active = true,
        left_at = null,
        role = case
          when public.club_members.role in ('owner', 'manager', 'member') then public.club_members.role
          else 'member'
        end;

  return v_club_id;
end;
$$;

grant execute on function public.join_club_by_invite(text, text) to authenticated;

create or replace function public.join_club_by_invite_as_guest(
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
    and invite_expires_at > now()
  limit 1;

  if v_club_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.club_members (club_id, user_id, role, nickname, is_active, left_at)
  values (v_club_id, v_user_id, 'guest', trim(p_nickname), true, null)
  on conflict (club_id, user_id)
  do update
    set nickname = excluded.nickname,
        is_active = true,
        left_at = null,
        role = case
          when public.club_members.role in ('owner', 'manager', 'member') then public.club_members.role
          else 'guest'
        end;

  return v_club_id;
end;
$$;

grant execute on function public.join_club_by_invite_as_guest(text, text) to authenticated;

create or replace function public.remove_club_member(
  p_club_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_target_user_id uuid;
  v_target_role public.club_member_role;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = v_user_id
      and cm.role = 'owner'
      and cm.is_active = true
  ) then
    raise exception 'Only owner can remove member';
  end if;

  select cm.user_id, cm.role
    into v_target_user_id, v_target_role
  from public.club_members cm
  where cm.id = p_member_id
    and cm.club_id = p_club_id
    and cm.is_active = true;

  if v_target_user_id is null then
    raise exception 'Member not found';
  end if;

  if v_target_role = 'owner' then
    raise exception 'Owner cannot be removed';
  end if;

  if v_target_user_id = v_user_id then
    raise exception 'Cannot remove yourself';
  end if;

  update public.club_members cm
  set is_active = false,
      left_at = now()
  where cm.id = p_member_id
    and cm.club_id = p_club_id
    and cm.is_active = true;
end;
$$;

grant execute on function public.remove_club_member(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
