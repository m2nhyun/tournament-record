-- Allow club admins to add roster members before those people sign in.
-- The member row preserves match/history identity, and a later registered
-- user can claim the row through an invite-code guarded flow.

alter table public.club_members
  alter column user_id drop not null;

create or replace function public.add_unclaimed_club_member(
  p_club_id uuid,
  p_nickname text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_club_admin(p_club_id) then
    raise exception '클럽 운영진만 멤버를 추가할 수 있습니다.';
  end if;

  insert into public.club_members (club_id, user_id, role, nickname, is_active, left_at)
  values (p_club_id, null, 'member', trim(p_nickname), true, null)
  returning id into v_member_id;

  return v_member_id;
end;
$$;

alter function public.add_unclaimed_club_member(uuid, text)
  owner to postgres;

grant execute on function public.add_unclaimed_club_member(uuid, text)
  to authenticated;

create or replace function public.find_claimable_club_member_by_invite(
  p_invite_code text,
  p_display_name text
)
returns table (
  id uuid,
  club_id uuid,
  club_name text,
  nickname text
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_club_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception '정회원만 기존 멤버와 연결할 수 있습니다.';
  end if;

  select c.id
    into v_club_id
  from public.clubs c
  where c.invite_code = upper(trim(p_invite_code))
    and c.invite_expires_at > now()
  limit 1;

  if v_club_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  if exists (
    select 1
    from public.club_members existing
    where existing.club_id = v_club_id
      and existing.user_id = v_user_id
      and existing.is_active = true
  ) then
    return;
  end if;

  return query
  select cm.id, cm.club_id, c.name, cm.nickname
  from public.club_members cm
  join public.clubs c on c.id = cm.club_id
  where cm.club_id = v_club_id
    and cm.user_id is null
    and cm.is_active = true
    and cm.role = 'member'
    and lower(trim(cm.nickname)) = lower(trim(p_display_name))
  order by cm.created_at asc
  limit 1;
end;
$$;

alter function public.find_claimable_club_member_by_invite(text, text)
  owner to postgres;

grant execute on function public.find_claimable_club_member_by_invite(text, text)
  to authenticated;

create or replace function public.claim_club_member_by_invite(
  p_invite_code text,
  p_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_club_id uuid;
  v_target record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception '정회원만 기존 멤버와 연결할 수 있습니다.';
  end if;

  select c.id
    into v_club_id
  from public.clubs c
  where c.invite_code = upper(trim(p_invite_code))
    and c.invite_expires_at > now()
  limit 1;

  if v_club_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  if exists (
    select 1
    from public.club_members existing
    where existing.club_id = v_club_id
      and existing.user_id = v_user_id
      and existing.is_active = true
  ) then
    return v_club_id;
  end if;

  select cm.id, cm.user_id, cm.role
    into v_target
  from public.club_members cm
  where cm.id = p_member_id
    and cm.club_id = v_club_id
    and cm.is_active = true
  for update;

  if v_target.id is null then
    raise exception '연결할 멤버를 찾을 수 없습니다.';
  end if;

  if v_target.user_id is not null then
    raise exception '이미 다른 계정과 연결된 멤버입니다.';
  end if;

  if v_target.role <> 'member' then
    raise exception '일반 멤버만 계정과 연결할 수 있습니다.';
  end if;

  update public.club_members cm
  set user_id = v_user_id,
      is_active = true,
      left_at = null
  where cm.id = p_member_id
    and cm.club_id = v_club_id;

  return v_club_id;
end;
$$;

alter function public.claim_club_member_by_invite(text, uuid)
  owner to postgres;

grant execute on function public.claim_club_member_by_invite(text, uuid)
  to authenticated;

create or replace function public.remove_club_member(
  p_club_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_target record;
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
    into v_target
  from public.club_members cm
  where cm.id = p_member_id
    and cm.club_id = p_club_id
    and cm.is_active = true;

  if v_target.role is null then
    raise exception 'Member not found';
  end if;

  if v_target.role = 'owner' then
    raise exception 'Owner cannot be removed';
  end if;

  if v_target.user_id = v_user_id then
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

alter function public.remove_club_member(uuid, uuid)
  owner to postgres;

grant execute on function public.remove_club_member(uuid, uuid)
  to authenticated;

create or replace function public.set_club_member_role(
  p_club_id uuid,
  p_member_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_caller_member_id uuid;
  v_target record;
  v_new_role public.club_member_role;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_role not in ('manager', 'member') then
    raise exception '허용되지 않은 역할입니다.';
  end if;
  v_new_role := p_role::public.club_member_role;

  select cm.id
    into v_caller_member_id
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.user_id = v_user_id
    and cm.role = 'owner'
    and cm.is_active = true;

  if v_caller_member_id is null then
    raise exception '클럽 방장만 운영진을 지정할 수 있습니다.';
  end if;

  select cm.id, cm.user_id, cm.role
    into v_target
  from public.club_members cm
  where cm.id = p_member_id
    and cm.club_id = p_club_id
    and cm.is_active = true;

  if v_target.id is null then
    raise exception '대상 멤버를 찾을 수 없습니다.';
  end if;

  if v_target.user_id is null then
    raise exception '계정 연결 전에는 운영진으로 지정할 수 없습니다.';
  end if;

  if v_target.user_id = v_user_id then
    raise exception '본인 역할은 변경할 수 없습니다.';
  end if;

  if v_target.role = 'owner' then
    raise exception '클럽 방장의 역할은 변경할 수 없습니다.';
  end if;

  if v_target.role = 'guest' then
    raise exception '게스트는 이 화면에서 역할을 변경할 수 없습니다.';
  end if;

  if v_target.role = v_new_role then
    return;
  end if;

  update public.club_members
  set role = v_new_role
  where id = p_member_id;
end;
$$;

alter function public.set_club_member_role(uuid, uuid, text)
  owner to postgres;

grant execute on function public.set_club_member_role(uuid, uuid, text)
  to authenticated;
