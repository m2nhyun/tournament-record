-- P1-B: Host can cancel their own match_schedule.
--
-- Adds cancel_match_schedule RPC so the schedule host can flip status
-- to 'cancelled' from /clubs/[clubId]/schedules/[scheduleId]. Participants
-- and pending requests stay attached for history; UI surfaces the cancelled
-- state via the existing status badge.
--
-- Guard rules (in RPC):
--   - Caller must be authenticated.
--   - Caller's active club_member.id must equal match_schedules.host_member_id.
--   - Already-cancelled schedules return idempotently.
--   - Schedules whose ends_at has passed cannot be cancelled (no behavioral
--     change anyway, and avoids rewriting audit trail).

create or replace function public.cancel_match_schedule(p_schedule_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_schedule record;
  v_my_member_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.id,
         ms.club_id,
         ms.host_member_id,
         ms.status,
         ms.ends_at
    into v_schedule
  from public.match_schedules ms
  where ms.id = p_schedule_id;

  if not found then
    raise exception '취소할 일정을 찾을 수 없습니다.';
  end if;

  select cm.id
    into v_my_member_id
  from public.club_members cm
  where cm.club_id = v_schedule.club_id
    and cm.user_id = v_user_id
    and cm.is_active = true
  limit 1;

  if v_my_member_id is null or v_my_member_id <> v_schedule.host_member_id then
    raise exception '일정 개설자만 취소할 수 있습니다.';
  end if;

  if v_schedule.status = 'cancelled' then
    return v_schedule.id;
  end if;

  if v_schedule.ends_at <= now() then
    raise exception '종료된 일정은 취소할 수 없습니다.';
  end if;

  update public.match_schedules
  set status = 'cancelled',
      updated_at = now()
  where id = p_schedule_id;

  return p_schedule_id;
end;
$$;

alter function public.cancel_match_schedule(uuid) owner to postgres;

-- Whitelist policy (keep-rules §2-1): anon EXECUTE is denied by default,
-- so we only grant to authenticated. Service role retains implicit access.
grant execute on function public.cancel_match_schedule(uuid) to authenticated;
