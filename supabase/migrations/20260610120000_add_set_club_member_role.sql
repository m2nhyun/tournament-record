-- Owner-only RPC to promote/demote a club member between 'member' and
-- 'manager'. No UI/RPC existed before, so owners had to flip
-- club_members.role directly in SQL — not a viable operational path.
--
-- Guard rules:
--   - Caller must be the active owner of p_club_id.
--   - Target must be an active member of the same club.
--   - Target cannot be the caller (no self-promote/demote).
--   - Target cannot be the owner (one-owner invariant stays intact;
--     ownership transfer is a separate flow if ever needed).
--   - Target cannot be 'guest' (guests don't graduate to manager via
--     this surface; they go through the regular join flow first).
--   - New role must be 'manager' or 'member'.
--   - Idempotent: setting the same role is a no-op (returns silently).

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
