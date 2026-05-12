-- Club Record DB smoke scenarios.
--
-- Run after applying the four club_record migrations to a disposable local or
-- staging database. The script creates temporary test data and rolls it back.
-- Do not use this as a production data migration.

begin;

create temp table club_record_smoke_ids (
  key text primary key,
  value uuid not null
) on commit drop;

grant select, insert, update, delete on club_record_smoke_ids to authenticated;

do $$
declare
  v_club_id uuid := gen_random_uuid();
  v_other_club_id uuid := gen_random_uuid();
  v_sync_club_id uuid := gen_random_uuid();
  v_owner_user_id uuid := gen_random_uuid();
  v_manager_user_id uuid := gen_random_uuid();
  v_member_user_id uuid := gen_random_uuid();
  v_inactive_user_id uuid := gen_random_uuid();
  v_observer_user_id uuid := gen_random_uuid();
  v_nonparticipant_user_id uuid := gen_random_uuid();
  v_guest_user_id uuid := gen_random_uuid();
  v_invited_guest_user_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_sync_owner_user_id uuid := gen_random_uuid();
  v_sync_manager_user_id uuid := gen_random_uuid();
  v_sync_member_user_id uuid := gen_random_uuid();
  v_sync_inactive_user_id uuid := gen_random_uuid();
  v_sync_guest_user_id uuid := gen_random_uuid();
  v_owner_member_id uuid := gen_random_uuid();
  v_manager_member_id uuid := gen_random_uuid();
  v_member_member_id uuid := gen_random_uuid();
  v_inactive_member_id uuid := gen_random_uuid();
  v_observer_member_id uuid := gen_random_uuid();
  v_nonparticipant_member_id uuid := gen_random_uuid();
  v_other_member_id uuid := gen_random_uuid();
  v_sync_owner_member_id uuid := gen_random_uuid();
  v_sync_manager_member_id uuid := gen_random_uuid();
  v_sync_member_member_id uuid := gen_random_uuid();
  v_sync_inactive_member_id uuid := gen_random_uuid();
  v_sync_guest_member_id uuid := gen_random_uuid();
  v_guest_profile_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_slot_confirmed_id uuid := gen_random_uuid();
  v_slot_late_guard_id uuid := gen_random_uuid();
  v_slot_member_submit_id uuid := gen_random_uuid();
  v_slot_admin_update_id uuid := gen_random_uuid();
  v_slot_extra_id uuid := gen_random_uuid();
  v_slot_singles_id uuid := gen_random_uuid();
  v_owner_participant_id uuid := gen_random_uuid();
  v_manager_participant_id uuid := gen_random_uuid();
  v_member_participant_id uuid := gen_random_uuid();
  v_inactive_participant_id uuid := gen_random_uuid();
  v_guest_participant_id uuid := gen_random_uuid();
  v_late_participant_id uuid := gen_random_uuid();
  v_confirmed_match_id uuid := gen_random_uuid();
  v_singles_match_id uuid := gen_random_uuid();
  v_member_submit_match_id uuid := gen_random_uuid();
  v_admin_update_match_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (v_owner_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-owner-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_manager_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-manager-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_member_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-member-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_inactive_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-inactive-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_observer_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-observer-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_nonparticipant_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-nonparticipant-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_guest_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-guest-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_invited_guest_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-invited-guest-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_other_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-other-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_sync_owner_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-sync-owner-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_sync_manager_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-sync-manager-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_sync_member_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-sync-member-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_sync_inactive_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-sync-inactive-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_sync_guest_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'club-record-sync-guest-smoke@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.clubs (id, name, invite_code, created_by)
  values
    (v_club_id, 'CR Smoke Club', 'CRSMOKE1', v_owner_user_id),
    (v_other_club_id, 'CR Other Club', 'CRSMOKE2', v_other_user_id),
    (v_sync_club_id, 'CR Sync Club', 'CRSMOKE3', v_sync_owner_user_id);

  insert into public.club_members (id, club_id, user_id, role, nickname, is_active, left_at)
  values
    (v_owner_member_id, v_club_id, v_owner_user_id, 'owner', 'Smoke Owner', true, null),
    (v_manager_member_id, v_club_id, v_manager_user_id, 'manager', 'Smoke Manager', true, null),
    (v_member_member_id, v_club_id, v_member_user_id, 'member', 'Smoke Member', true, null),
    (v_inactive_member_id, v_club_id, v_inactive_user_id, 'member', 'Smoke Inactive', true, null),
    (v_observer_member_id, v_club_id, v_observer_user_id, 'member', 'Smoke Observer', true, null),
    (v_nonparticipant_member_id, v_club_id, v_nonparticipant_user_id, 'member', 'Smoke NP', true, null),
    (v_other_member_id, v_other_club_id, v_other_user_id, 'member', 'Smoke Other', true, null),
    (v_sync_owner_member_id, v_sync_club_id, v_sync_owner_user_id, 'owner', 'Sync Owner', true, null),
    (v_sync_manager_member_id, v_sync_club_id, v_sync_manager_user_id, 'manager', 'Sync Manager', true, null),
    (v_sync_member_member_id, v_sync_club_id, v_sync_member_user_id, 'member', 'Sync Member', true, null),
    (v_sync_inactive_member_id, v_sync_club_id, v_sync_inactive_user_id, 'member', 'Sync Inactive', false, now()),
    (v_sync_guest_member_id, v_sync_club_id, v_sync_guest_user_id, 'guest', 'Sync Guest', true, null);

  insert into public.club_record_settings (club_id)
  values
    (v_club_id),
    (v_sync_club_id);

  insert into public.club_record_members (
    club_id,
    club_member_id,
    ranking_position,
    group_code
  )
  values
    (v_club_id, v_owner_member_id, 1, 'A'),
    (v_club_id, v_manager_member_id, 2, 'A'),
    (v_club_id, v_member_member_id, 3, 'B'),
    (v_club_id, v_inactive_member_id, 4, 'B'),
    (v_club_id, v_observer_member_id, 5, 'C'),
    (v_club_id, v_nonparticipant_member_id, 6, 'C');

  insert into public.club_record_guest_profiles (
    id,
    club_id,
    guest_user_id,
    display_name,
    group_code
  )
  values (
    v_guest_profile_id,
    v_club_id,
    v_guest_user_id,
    'Smoke Guest',
    'C'
  );

  insert into public.club_record_events (
    id,
    club_id,
    title,
    event_date,
    starts_at,
    ends_at,
    court_count,
    status,
    created_by,
    updated_by
  )
  values (
    v_event_id,
    v_club_id,
    'Club Record Smoke Event',
    current_date,
    current_date + time '10:00',
    current_date + time '12:00',
    2,
    'open',
    v_owner_user_id,
    v_owner_user_id
  );

  insert into public.club_record_guest_invites (
    club_id,
    event_id,
    code,
    issued_by,
    expires_at,
    is_active
  )
  values (
    v_club_id,
    v_event_id,
    'CRJOIN01',
    v_owner_user_id,
    now() + interval '1 day',
    true
  );

  insert into public.club_record_event_slots (
    id,
    event_id,
    court_number,
    slot_order,
    starts_at,
    ends_at,
    status,
    is_locked
  )
  values
    (v_slot_confirmed_id, v_event_id, 1, 1, current_date + time '10:00', current_date + time '10:30', 'completed', true),
    (v_slot_late_guard_id, v_event_id, 2, 1, current_date + time '10:00', current_date + time '10:30', 'scheduled', false),
    (v_slot_member_submit_id, v_event_id, 1, 2, current_date + time '10:30', current_date + time '11:00', 'ready', true),
    (v_slot_admin_update_id, v_event_id, 2, 2, current_date + time '10:30', current_date + time '11:00', 'cancelled', true),
    (v_slot_extra_id, v_event_id, 1, 3, current_date + time '11:00', current_date + time '11:30', 'scheduled', false),
    (v_slot_singles_id, v_event_id, 2, 3, current_date + time '11:00', current_date + time '11:30', 'completed', true);

  insert into public.club_record_event_participants (
    id,
    event_id,
    participant_type,
    club_member_id,
    guest_profile_id,
    arrival_time,
    added_by
  )
  values
    (v_owner_participant_id, v_event_id, 'member', v_owner_member_id, null, null, v_owner_user_id),
    (v_manager_participant_id, v_event_id, 'member', v_manager_member_id, null, null, v_owner_user_id),
    (v_member_participant_id, v_event_id, 'member', v_member_member_id, null, null, v_owner_user_id),
    (v_inactive_participant_id, v_event_id, 'member', v_inactive_member_id, null, null, v_owner_user_id),
    (v_guest_participant_id, v_event_id, 'guest', null, v_guest_profile_id, null, v_owner_user_id),
    (v_late_participant_id, v_event_id, 'member', v_observer_member_id, null, current_date + time '11:00', v_owner_user_id);

  update public.club_members
  set is_active = false,
      left_at = now()
  where id = v_inactive_member_id;

  insert into public.club_record_matches (
    id,
    event_id,
    slot_id,
    status,
    assignment_mode,
    is_manual,
    result_entered_by,
    result_entered_at,
    confirmed_at,
    created_by,
    updated_by
  )
  values
    (v_confirmed_match_id, v_event_id, v_slot_confirmed_id, 'confirmed', 'manual', true, v_member_user_id, now(), now(), v_owner_user_id, v_owner_user_id),
    (v_singles_match_id, v_event_id, v_slot_singles_id, 'confirmed', 'manual', true, v_member_user_id, now(), now(), v_owner_user_id, v_owner_user_id),
    (v_member_submit_match_id, v_event_id, v_slot_member_submit_id, 'pending_result', 'manual', true, null, null, null, v_owner_user_id, v_owner_user_id),
    (v_admin_update_match_id, v_event_id, v_slot_admin_update_id, 'cancelled', 'manual', true, null, null, null, v_owner_user_id, v_owner_user_id);

  insert into public.club_record_match_players (match_id, participant_id, side, position)
  values
    (v_confirmed_match_id, v_owner_participant_id, 1, 1),
    (v_confirmed_match_id, v_manager_participant_id, 1, 2),
    (v_confirmed_match_id, v_member_participant_id, 2, 1),
    (v_confirmed_match_id, v_guest_participant_id, 2, 2),
    (v_singles_match_id, v_member_participant_id, 1, 1),
    (v_singles_match_id, v_owner_participant_id, 2, 1),
    (v_member_submit_match_id, v_owner_participant_id, 1, 1),
    (v_member_submit_match_id, v_manager_participant_id, 1, 2),
    (v_member_submit_match_id, v_member_participant_id, 2, 1),
    (v_member_submit_match_id, v_guest_participant_id, 2, 2),
    (v_admin_update_match_id, v_owner_participant_id, 1, 1),
    (v_admin_update_match_id, v_manager_participant_id, 1, 2),
    (v_admin_update_match_id, v_member_participant_id, 2, 1),
    (v_admin_update_match_id, v_guest_participant_id, 2, 2);

  insert into public.club_record_match_results (
    match_id,
    winning_side,
    losing_side,
    is_draw,
    score_text,
    entered_by_participant_id
  )
  values
    (v_confirmed_match_id, 1, 2, false, '6-4', v_member_participant_id),
    (v_singles_match_id, 1, 2, false, '6-2', v_member_participant_id);

  insert into club_record_smoke_ids (key, value)
  values
    ('club', v_club_id),
    ('sync_club', v_sync_club_id),
    ('owner_user', v_owner_user_id),
    ('manager_user', v_manager_user_id),
    ('member_user', v_member_user_id),
    ('inactive_user', v_inactive_user_id),
    ('observer_user', v_observer_user_id),
    ('nonparticipant_user', v_nonparticipant_user_id),
    ('guest_user', v_guest_user_id),
    ('invited_guest_user', v_invited_guest_user_id),
    ('sync_owner_user', v_sync_owner_user_id),
    ('sync_member_user', v_sync_member_user_id),
    ('event', v_event_id),
    ('club_member_owner', v_owner_member_id),
    ('club_member_manager', v_manager_member_id),
    ('club_member_member', v_member_member_id),
    ('club_member_observer', v_observer_member_id),
    ('club_member_nonparticipant', v_nonparticipant_member_id),
    ('club_member_other', v_other_member_id),
    ('slot_confirmed', v_slot_confirmed_id),
    ('slot_late_guard', v_slot_late_guard_id),
    ('slot_singles', v_slot_singles_id),
    ('participant_owner', v_owner_participant_id),
    ('participant_member', v_member_participant_id),
    ('participant_guest', v_guest_participant_id),
    ('participant_late', v_late_participant_id),
    ('match_confirmed', v_confirmed_match_id),
    ('match_singles', v_singles_match_id),
    ('match_member_submit', v_member_submit_match_id),
    ('match_admin_update', v_admin_update_match_id);
end $$;

do $$
begin
  begin
    delete from public.club_record_matches
    where id = (select value from club_record_smoke_ids where key = 'match_confirmed');
    raise exception 'smoke_expected_failure';
  exception
    when others then
      if sqlerrm = 'smoke_expected_failure' then
        raise;
      end if;
      raise notice 'ok: confirmed match direct delete blocked: %', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    delete from public.club_record_event_slots
    where id = (select value from club_record_smoke_ids where key = 'slot_confirmed');
    raise exception 'smoke_expected_failure';
  exception
    when others then
      if sqlerrm = 'smoke_expected_failure' then
        raise;
      end if;
      raise notice 'ok: slot cascade delete of confirmed match blocked: %', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    delete from public.club_record_event_participants
    where id = (select value from club_record_smoke_ids where key = 'participant_member');
    raise exception 'smoke_expected_failure';
  exception
    when others then
      if sqlerrm = 'smoke_expected_failure' then
        raise;
      end if;
      raise notice 'ok: linked participant direct delete blocked: %', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    update public.club_record_events
    set is_deleted = true,
        deleted_at = now(),
        status = 'cancelled'
    where id = (select value from club_record_smoke_ids where key = 'event');
    raise exception 'smoke_expected_failure';
  exception
    when others then
      if sqlerrm = 'smoke_expected_failure' then
        raise;
      end if;
      raise notice 'ok: confirmed event soft delete/cancel blocked: %', sqlerrm;
  end;
end $$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'manager_user'),
  true
);

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'sync_owner_user'),
  true
);

do $$
declare
  v_inserted integer;
  v_second_inserted integer;
  v_total integer;
  v_distinct integer;
  v_min integer;
  v_max integer;
  v_group_a integer;
  v_group_b integer;
  v_group_c integer;
begin
  v_inserted := public.sync_club_record_members(
    (select value from club_record_smoke_ids where key = 'sync_club')
  );

  if v_inserted <> 3 then
    raise exception 'member sync inserted %, expected 3 active non-guest members', v_inserted;
  end if;

  v_second_inserted := public.sync_club_record_members(
    (select value from club_record_smoke_ids where key = 'sync_club')
  );

  if v_second_inserted <> 0 then
    raise exception 'member sync was not idempotent, inserted % on second call', v_second_inserted;
  end if;

  select
    count(*)::integer,
    count(distinct crm.ranking_position)::integer,
    min(crm.ranking_position),
    max(crm.ranking_position),
    count(*) filter (where crm.group_code = 'A')::integer,
    count(*) filter (where crm.group_code = 'B')::integer,
    count(*) filter (where crm.group_code = 'C')::integer
    into v_total, v_distinct, v_min, v_max, v_group_a, v_group_b, v_group_c
  from public.club_record_members crm
  join public.club_members cm
    on cm.id = crm.club_member_id
  where crm.club_id = (select value from club_record_smoke_ids where key = 'sync_club');

  if v_total <> 3 or v_distinct <> 3 or v_min <> 1 or v_max <> 3 then
    raise exception 'member sync left invalid ranking positions: total %, distinct %, min %, max %',
      v_total,
      v_distinct,
      v_min,
      v_max;
  end if;

  if v_group_a <> 1 or v_group_b <> 1 or v_group_c <> 1 then
    raise exception 'member sync did not recalculate groups: A %, B %, C %',
      v_group_a,
      v_group_b,
      v_group_c;
  end if;

  if exists (
    select 1
    from public.club_record_members crm
    join public.club_members cm
      on cm.id = crm.club_member_id
    where crm.club_id = (select value from club_record_smoke_ids where key = 'sync_club')
      and (cm.is_active = false or cm.role = 'guest')
  ) then
    raise exception 'member sync inserted inactive or guest club member';
  end if;

  raise notice 'ok: member ranking sync inserts active non-guest members, is idempotent, and recalculates groups';
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'sync_member_user'),
  true
);

do $$
begin
  begin
    perform public.sync_club_record_members(
      (select value from club_record_smoke_ids where key = 'sync_club')
    );
    raise exception 'smoke_expected_failure';
  exception
    when others then
      if sqlerrm = 'smoke_expected_failure' then
        raise;
      end if;
      raise notice 'ok: non-admin member ranking sync blocked: %', sqlerrm;
  end;
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'manager_user'),
  true
);

do $$
declare
  v_total integer;
  v_distinct integer;
  v_min integer;
  v_max integer;
begin
  perform public.move_club_record_ranking(
    (select value from club_record_smoke_ids where key = 'club'),
    (select value from club_record_smoke_ids where key = 'club_member_manager'),
    1
  );

  perform public.move_club_record_ranking(
    (select value from club_record_smoke_ids where key = 'club'),
    (select value from club_record_smoke_ids where key = 'club_member_owner'),
    5
  );

  perform public.move_club_record_ranking(
    (select value from club_record_smoke_ids where key = 'club'),
    (select value from club_record_smoke_ids where key = 'club_member_observer'),
    1
  );

  select
    count(*)::integer,
    count(distinct ranking_position)::integer,
    min(ranking_position),
    max(ranking_position)
    into v_total, v_distinct, v_min, v_max
  from public.club_record_members
  where club_id = (select value from club_record_smoke_ids where key = 'club');

  if v_total <> v_distinct or v_min <> 1 or v_max <> v_total then
    raise exception 'ranking move left duplicate or non-contiguous positions';
  end if;

  raise notice 'ok: ranking moves avoid unique collisions and keep contiguous positions';
end $$;

do $$
begin
  begin
    insert into public.club_record_event_participants (
      event_id,
      participant_type,
      club_member_id,
      added_by
    )
    values (
      (select value from club_record_smoke_ids where key = 'event'),
      'member',
      (select value from club_record_smoke_ids where key = 'club_member_other'),
      (select value from club_record_smoke_ids where key = 'manager_user')
    );
    raise exception 'smoke_expected_failure';
  exception
    when others then
      if sqlerrm = 'smoke_expected_failure' then
        raise;
      end if;
      raise notice 'ok: cross-club member participant insert blocked: %', sqlerrm;
  end;
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'invited_guest_user'),
  true
);

do $$
declare
  v_participant_id uuid;
begin
  select participant_id
    into v_participant_id
  from public.join_club_record_event_guest_by_invite_code(
    'CRJOIN01',
    'Smoke Invited Guest',
    null,
    null,
    'C',
    null
  );

  if v_participant_id is null then
    raise exception 'guest invite join did not return a participant id';
  end if;

  raise notice 'ok: invited non-admin guest join RPC inserted participant';
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'manager_user'),
  true
);

do $$
begin
  begin
    perform public.create_club_record_manual_match(
      (select value from club_record_smoke_ids where key = 'event'),
      (select value from club_record_smoke_ids where key = 'slot_late_guard'),
      jsonb_build_array(
        jsonb_build_object('participantId', (select value from club_record_smoke_ids where key = 'participant_late'), 'side', 1, 'position', 1),
        jsonb_build_object('participantId', (select value from club_record_smoke_ids where key = 'participant_member'), 'side', 1, 'position', 2),
        jsonb_build_object('participantId', (select value from club_record_smoke_ids where key = 'participant_guest'), 'side', 2, 'position', 1),
        jsonb_build_object('participantId', (select value from club_record_smoke_ids where key = 'participant_owner'), 'side', 2, 'position', 2)
      )
    );
    raise exception 'smoke_expected_failure';
  exception
    when others then
      if sqlerrm = 'smoke_expected_failure' then
        raise;
      end if;
      raise notice 'ok: manual match before late arrival blocked: %', sqlerrm;
  end;
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'inactive_user'),
  true
);

do $$
begin
  if public.is_club_record_event_participant(
    (select value from club_record_smoke_ids where key = 'event')
  ) then
    raise exception 'inactive member unexpectedly passed event participant helper';
  end if;

  if public.can_submit_club_record_result(
    (select value from club_record_smoke_ids where key = 'match_member_submit')
  ) then
    raise exception 'inactive member unexpectedly passed result permission helper';
  end if;

  raise notice 'ok: inactive member helper access blocked';
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'nonparticipant_user'),
  true
);

do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
  from public.get_club_record_event_slots_overview(
    (select value from club_record_smoke_ids where key = 'event')
  );

  if v_count <> 0 then
    raise exception 'non-participant member unexpectedly saw event slot overview';
  end if;

  raise notice 'ok: non-participant member slot overview blocked';
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'member_user'),
  true
);

do $$
declare
  v_count integer;
  v_team_names text[];
  v_partner_names text[];
  v_opponent_names text[];
begin
  select count(*)
    into v_count
  from public.get_club_record_event_slots_overview(
    (select value from club_record_smoke_ids where key = 'event')
  );

  if v_count = 0 then
    raise exception 'event participant did not see event slot overview';
  end if;

  if exists (
    select 1
    from public.get_club_record_event_participants(
      (select value from club_record_smoke_ids where key = 'event')
    ) p
    where p.id <> (select value from club_record_smoke_ids where key = 'participant_member')
      and p.club_member_id is not null
  ) then
    raise exception 'member saw another member internal club_member_id';
  end if;

  if exists (
    select 1
    from public.get_club_record_event_participants(
      (select value from club_record_smoke_ids where key = 'event')
    ) p
    where p.ranking_position is not null
  ) then
    raise exception 'member saw ranking_position in participant RPC';
  end if;

  select h.team_names, h.partner_names, h.opponent_names
    into v_team_names, v_partner_names, v_opponent_names
  from public.get_my_club_record_history(
    (select value from club_record_smoke_ids where key = 'club')
  ) h
  where h.match_id = (select value from club_record_smoke_ids where key = 'match_confirmed');

  if coalesce(v_team_names, '{}'::text[]) <> array['Smoke Member', 'Smoke Guest']::text[] then
    raise exception 'my club record history did not include full team names: %', v_team_names;
  end if;

  if not ('Smoke Guest' = any(coalesce(v_partner_names, '{}'::text[]))) then
    raise exception 'my club record history did not include guest partner display name: %', v_partner_names;
  end if;

  if not ('Smoke Owner' = any(coalesce(v_opponent_names, '{}'::text[])))
    or not ('Smoke Manager' = any(coalesce(v_opponent_names, '{}'::text[]))) then
    raise exception 'my club record history did not include registered opponent names: %', v_opponent_names;
  end if;

  select h.team_names, h.partner_names, h.opponent_names
    into v_team_names, v_partner_names, v_opponent_names
  from public.get_my_club_record_history(
    (select value from club_record_smoke_ids where key = 'club')
  ) h
  where h.match_id = (select value from club_record_smoke_ids where key = 'match_singles');

  if coalesce(v_team_names, '{}'::text[]) <> array['Smoke Member']::text[] then
    raise exception 'my club record singles history did not include only self team name: %', v_team_names;
  end if;

  if coalesce(v_partner_names, '{}'::text[]) <> '{}'::text[] then
    raise exception 'my club record singles history should not include partner names: %', v_partner_names;
  end if;

  if not ('Smoke Owner' = any(coalesce(v_opponent_names, '{}'::text[]))) then
    raise exception 'my club record singles history did not include opponent name: %', v_opponent_names;
  end if;

  raise notice 'ok: event participant overview allowed and sensitive fields redacted';
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'manager_user'),
  true
);

do $$
declare
  v_team_names text[];
  v_partner_names text[];
begin
  select h.team_names, h.partner_names
    into v_team_names, v_partner_names
  from public.get_club_record_member_history(
    (select value from club_record_smoke_ids where key = 'club'),
    (select value from club_record_smoke_ids where key = 'club_member_member')
  ) h
  where h.match_id = (select value from club_record_smoke_ids where key = 'match_confirmed');

  if coalesce(v_team_names, '{}'::text[]) <> array['Smoke Member', 'Smoke Guest']::text[] then
    raise exception 'admin member history did not include full team names: %', v_team_names;
  end if;

  if not ('Smoke Guest' = any(coalesce(v_partner_names, '{}'::text[]))) then
    raise exception 'admin member history did not include guest partner display name: %', v_partner_names;
  end if;

  raise notice 'ok: history RPCs include full team names and guest display names';
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'guest_user'),
  true
);

do $$
begin
  begin
    perform public.submit_club_record_match_result(
      (select value from club_record_smoke_ids where key = 'match_member_submit'),
      '6-3',
      false,
      1,
      2
    );
    raise exception 'smoke_expected_failure';
  exception
    when others then
      if sqlerrm = 'smoke_expected_failure' then
        raise;
      end if;
      raise notice 'ok: guest result submission blocked: %', sqlerrm;
  end;
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'member_user'),
  true
);

select public.submit_club_record_match_result(
  (select value from club_record_smoke_ids where key = 'match_member_submit'),
  '6-3',
  false,
  1,
  2
);

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'manager_user'),
  true
);

select public.update_club_record_match_result(
  (select value from club_record_smoke_ids where key = 'match_admin_update'),
  '5-5',
  true,
  null,
  null
);

select set_config(
  'request.jwt.claim.sub',
  (select value::text from club_record_smoke_ids where key = 'owner_user'),
  true
);

do $$
declare
  v_deleted_event_id uuid := gen_random_uuid();
  v_cancelled_event_id uuid := gen_random_uuid();
  v_deleted_slot_id uuid := gen_random_uuid();
  v_cancelled_slot_id uuid := gen_random_uuid();
  v_deleted_match_id uuid := gen_random_uuid();
  v_cancelled_match_id uuid := gen_random_uuid();
  v_deleted_owner_participant_id uuid := gen_random_uuid();
  v_deleted_manager_participant_id uuid := gen_random_uuid();
  v_deleted_member_participant_id uuid := gen_random_uuid();
  v_deleted_observer_participant_id uuid := gen_random_uuid();
  v_cancelled_owner_participant_id uuid := gen_random_uuid();
  v_cancelled_manager_participant_id uuid := gen_random_uuid();
  v_cancelled_member_participant_id uuid := gen_random_uuid();
  v_cancelled_observer_participant_id uuid := gen_random_uuid();
begin
  insert into public.club_record_events (
    id,
    club_id,
    title,
    event_date,
    starts_at,
    ends_at,
    court_count,
    status,
    is_deleted,
    deleted_at,
    created_by,
    updated_by
  )
  values
    (
      v_deleted_event_id,
      (select value from club_record_smoke_ids where key = 'club'),
      'CR Deleted Event',
      current_date,
      current_date + time '13:00',
      current_date + time '13:30',
      1,
      'open',
      false,
      null,
      (select value from club_record_smoke_ids where key = 'owner_user'),
      (select value from club_record_smoke_ids where key = 'owner_user')
    ),
    (
      v_cancelled_event_id,
      (select value from club_record_smoke_ids where key = 'club'),
      'CR Cancelled Event',
      current_date,
      current_date + time '14:00',
      current_date + time '14:30',
      1,
      'open',
      false,
      null,
      (select value from club_record_smoke_ids where key = 'owner_user'),
      (select value from club_record_smoke_ids where key = 'owner_user')
    );

  insert into public.club_record_event_slots (
    id,
    event_id,
    court_number,
    slot_order,
    starts_at,
    ends_at,
    status,
    is_locked
  )
  values
    (v_deleted_slot_id, v_deleted_event_id, 1, 1, current_date + time '13:00', current_date + time '13:30', 'completed', true),
    (v_cancelled_slot_id, v_cancelled_event_id, 1, 1, current_date + time '14:00', current_date + time '14:30', 'completed', true);

  insert into public.club_record_event_participants (
    id,
    event_id,
    participant_type,
    club_member_id,
    added_by
  )
  values
    (v_deleted_owner_participant_id, v_deleted_event_id, 'member', (select value from club_record_smoke_ids where key = 'club_member_owner'), (select value from club_record_smoke_ids where key = 'owner_user')),
    (v_deleted_manager_participant_id, v_deleted_event_id, 'member', (select value from club_record_smoke_ids where key = 'club_member_manager'), (select value from club_record_smoke_ids where key = 'owner_user')),
    (v_deleted_member_participant_id, v_deleted_event_id, 'member', (select value from club_record_smoke_ids where key = 'club_member_member'), (select value from club_record_smoke_ids where key = 'owner_user')),
    (v_deleted_observer_participant_id, v_deleted_event_id, 'member', (select value from club_record_smoke_ids where key = 'club_member_observer'), (select value from club_record_smoke_ids where key = 'owner_user')),
    (v_cancelled_owner_participant_id, v_cancelled_event_id, 'member', (select value from club_record_smoke_ids where key = 'club_member_owner'), (select value from club_record_smoke_ids where key = 'owner_user')),
    (v_cancelled_manager_participant_id, v_cancelled_event_id, 'member', (select value from club_record_smoke_ids where key = 'club_member_manager'), (select value from club_record_smoke_ids where key = 'owner_user')),
    (v_cancelled_member_participant_id, v_cancelled_event_id, 'member', (select value from club_record_smoke_ids where key = 'club_member_member'), (select value from club_record_smoke_ids where key = 'owner_user')),
    (v_cancelled_observer_participant_id, v_cancelled_event_id, 'member', (select value from club_record_smoke_ids where key = 'club_member_observer'), (select value from club_record_smoke_ids where key = 'owner_user'));

  update public.club_record_events
  set is_deleted = true,
      deleted_at = now()
  where id = v_deleted_event_id;

  update public.club_record_events
  set status = 'cancelled'
  where id = v_cancelled_event_id;

  insert into public.club_record_matches (
    id,
    event_id,
    slot_id,
    status,
    assignment_mode,
    is_manual,
    result_entered_by,
    result_entered_at,
    confirmed_at,
    created_by,
    updated_by
  )
  values
    (v_deleted_match_id, v_deleted_event_id, v_deleted_slot_id, 'confirmed', 'manual', true, (select value from club_record_smoke_ids where key = 'owner_user'), now(), now(), (select value from club_record_smoke_ids where key = 'owner_user'), (select value from club_record_smoke_ids where key = 'owner_user')),
    (v_cancelled_match_id, v_cancelled_event_id, v_cancelled_slot_id, 'confirmed', 'manual', true, (select value from club_record_smoke_ids where key = 'owner_user'), now(), now(), (select value from club_record_smoke_ids where key = 'owner_user'), (select value from club_record_smoke_ids where key = 'owner_user'));

  insert into public.club_record_match_players (match_id, participant_id, side, position)
  values
    (v_deleted_match_id, v_deleted_owner_participant_id, 1, 1),
    (v_deleted_match_id, v_deleted_manager_participant_id, 1, 2),
    (v_deleted_match_id, v_deleted_member_participant_id, 2, 1),
    (v_deleted_match_id, v_deleted_observer_participant_id, 2, 2),
    (v_cancelled_match_id, v_cancelled_owner_participant_id, 1, 1),
    (v_cancelled_match_id, v_cancelled_manager_participant_id, 1, 2),
    (v_cancelled_match_id, v_cancelled_member_participant_id, 2, 1),
    (v_cancelled_match_id, v_cancelled_observer_participant_id, 2, 2);

  insert into public.club_record_match_results (
    match_id,
    winning_side,
    losing_side,
    is_draw,
    score_text,
    entered_by_participant_id
  )
  values
    (v_deleted_match_id, 2, 1, false, '6-0', v_deleted_owner_participant_id),
    (v_cancelled_match_id, 2, 1, false, '6-0', v_cancelled_owner_participant_id);

  raise notice 'ok: archived/cancelled monthly stats exclusion fixtures inserted';
end $$;

do $$
declare
  v_wins integer;
  v_losses integer;
  v_draws integer;
  v_win_rate numeric;
begin
  select wins, losses, draws, win_rate
    into v_wins, v_losses, v_draws, v_win_rate
  from public.get_club_record_monthly_public_card(
    (select value from club_record_smoke_ids where key = 'club'),
    date_trunc('month', current_date)::date
  )
  where club_member_id = (select value from club_record_smoke_ids where key = 'club_member_owner');

  if v_wins <> 2 or v_losses <> 1 or v_draws <> 1 then
    raise exception 'monthly public card included archived/cancelled event stats: wins %, losses %, draws %',
      v_wins,
      v_losses,
      v_draws;
  end if;

  if v_win_rate is null or round(v_win_rate, 0) <> 50 then
    raise exception 'monthly public card win_rate scale mismatch: %', v_win_rate;
  end if;

  raise notice 'ok: monthly public card excludes archived/cancelled events and uses 0..100 percentage scale';
end $$;

reset role;

do $$
begin
  if not exists (
    select 1
    from public.club_record_matches m
    where m.id = (select value from club_record_smoke_ids where key = 'match_member_submit')
      and m.status = 'confirmed'
  ) then
    raise exception 'member result submission did not confirm the match';
  end if;

  if not exists (
    select 1
    from public.club_record_matches m
    join public.club_record_match_results mr
      on mr.match_id = m.id
    where m.id = (select value from club_record_smoke_ids where key = 'match_admin_update')
      and m.status = 'confirmed'
      and mr.is_draw = true
      and mr.entered_by_participant_id is null
  ) then
    raise exception 'manager result update did not confirm cancelled/expired match with nullable participant';
  end if;

  raise notice 'ok: member result submit and manager result update paths passed';
end $$;

rollback;
