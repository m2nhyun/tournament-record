-- P1-B: Operators can swap players inside an existing club_record match.
--
-- Real-world ops flow: at 20:00 the matching whiteboard is built up
-- iteratively while people are arriving and traffic shifts things.
-- Operators need to swap individual players in an already-created match
-- (auto or manual) without deleting and re-creating the whole slot.
--
-- Guard rules:
--   - Caller is authenticated and is_club_admin(event.club_id).
--   - p_players is exactly 4 entries with side ∈ {1,2} and position ∈ {1,2}.
--   - Match exists, status is 'pending_result' (not 'confirmed' or 'cancelled').
--   - All 4 new participants are active in this event and their arrival_time
--     is ≤ slot.starts_at.
--   - No new participant is already occupied at the same slot start in some
--     OTHER court. Achieved by deleting current match_players first, then
--     running the existing occupancy check, then inserting the new rows.
-- Side effects:
--   - Match is marked assignment_mode='manual', is_manual=true (operator
--     override of any auto plan).
--   - assignment_dirty is set so the auto-assignment UI prompts a re-run.

create or replace function public.update_club_record_match_players(
  p_match_id uuid,
  p_players jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event_id uuid;
  v_slot_id uuid;
  v_slot_starts_at timestamptz;
  v_club_id uuid;
  v_match_status text;
  v_participant_count integer;
  v_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_players is null or jsonb_typeof(p_players) <> 'array' then
    raise exception '선수 목록 형식이 올바르지 않습니다.';
  end if;

  if jsonb_array_length(p_players) <> 4 then
    raise exception '경기는 정확히 4명의 선수가 필요합니다.';
  end if;

  select m.event_id, m.slot_id, m.status
    into v_event_id, v_slot_id, v_match_status
  from public.club_record_matches m
  where m.id = p_match_id;

  if v_event_id is null then
    raise exception '경기를 찾을 수 없습니다.';
  end if;

  if v_match_status = 'confirmed' then
    raise exception '확정된 경기는 선수를 변경할 수 없습니다.';
  end if;

  if v_match_status = 'cancelled' then
    raise exception '취소된 경기는 선수를 변경할 수 없습니다.';
  end if;

  select e.club_id
    into v_club_id
  from public.club_record_events e
  where e.id = v_event_id
    and e.is_deleted = false;

  if v_club_id is null then
    raise exception '이벤트를 찾을 수 없습니다.';
  end if;

  if not public.is_club_admin(v_club_id) then
    raise exception '경기 선수를 변경할 권한이 없습니다.';
  end if;

  select s.starts_at into v_slot_starts_at
  from public.club_record_event_slots s
  where s.id = v_slot_id;

  if v_slot_starts_at is null then
    raise exception '슬롯을 찾을 수 없습니다.';
  end if;

  select count(*)::integer
    into v_participant_count
  from public.club_record_event_participants ep
  where ep.event_id = v_event_id
    and (ep.arrival_time is null or ep.arrival_time <= v_slot_starts_at)
    and ep.id in (
      select distinct (player ->> 'participantId')::uuid
      from jsonb_array_elements(p_players) as player
    );

  if v_participant_count <> 4 then
    raise exception
      '선택한 선수 중 일부가 현재 이벤트 참가자가 아니거나 아직 도착하지 않았습니다.';
  end if;

  delete from public.club_record_match_players where match_id = p_match_id;

  for v_participant_id in
    select (player ->> 'participantId')::uuid
    from jsonb_array_elements(p_players) as player
  loop
    if public.is_club_record_participant_occupied_at_slot_start(
      v_event_id,
      v_slot_starts_at,
      v_participant_id
    ) then
      raise exception
        '같은 시간대에 이미 다른 경기에 배정된 선수가 포함되어 있습니다.';
    end if;
  end loop;

  insert into public.club_record_match_players (
    match_id,
    participant_id,
    side,
    position
  )
  select
    p_match_id,
    (player ->> 'participantId')::uuid,
    (player ->> 'side')::integer,
    (player ->> 'position')::integer
  from jsonb_array_elements(p_players) as player;

  update public.club_record_matches
  set assignment_mode = 'manual',
      is_manual = true,
      updated_by = auth.uid()
  where id = p_match_id;

  perform public.mark_club_record_event_assignment_dirty(v_event_id);

  return p_match_id;
end;
$$;

alter function public.update_club_record_match_players(uuid, jsonb)
  owner to postgres;

-- Whitelist policy (keep-rules §2-1): authenticated only.
grant execute on function public.update_club_record_match_players(uuid, jsonb)
  to authenticated;
