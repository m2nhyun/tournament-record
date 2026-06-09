-- P1-B: Expose participant gender so the auto-assignment can plan
-- gender-balanced doubles (여복 경기 N + 혼복).
--
-- Source of truth:
--   - Member participants → user_profiles.gender (linked via club_members.user_id)
--   - Guest participants  → club_record_guest_profiles.gender
--
-- Values: 'male' | 'female' | 'unspecified' | null (user_profiles_gender_check
-- and the guest_profile column allow these).
--
-- DROP first because PostgreSQL's CREATE OR REPLACE cannot change a function's
-- RETURNS TABLE shape (SQLSTATE 42P13). No other DB object depends on this
-- function (only direct client RPC calls), so a drop is safe.

drop function if exists public.get_club_record_event_participants(uuid);

create function public.get_club_record_event_participants(
  p_event_id uuid
)
returns table (
  id uuid,
  event_id uuid,
  participant_type public.club_record_participant_type,
  club_member_id uuid,
  guest_profile_id uuid,
  display_name text,
  arrival_time timestamptz,
  attendance_status public.club_record_attendance_status,
  group_code public.club_record_group_code,
  ranking_position integer,
  gender text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    ep.id,
    ep.event_id,
    ep.participant_type,
    case
      when public.is_club_admin(e.club_id) or cm.user_id = auth.uid() then ep.club_member_id
      else null
    end as club_member_id,
    case
      when public.is_club_admin(e.club_id) or gp.guest_user_id = auth.uid() then ep.guest_profile_id
      else null
    end as guest_profile_id,
    coalesce(cm.nickname, gp.display_name, '이름 없음') as display_name,
    ep.arrival_time,
    ep.attendance_status,
    case
      when ep.participant_type = 'member' then crm.group_code
      else gp.group_code
    end as group_code,
    case
      when ep.participant_type = 'member' and public.is_club_admin(e.club_id) then crm.ranking_position
      else null
    end as ranking_position,
    case
      when ep.participant_type = 'member' then up.gender
      else gp.gender
    end as gender
  from public.club_record_event_participants ep
  join public.club_record_events e
    on e.id = ep.event_id
  left join public.club_members cm
    on cm.id = ep.club_member_id
  left join public.club_record_members crm
    on crm.club_member_id = ep.club_member_id
  left join public.club_record_guest_profiles gp
    on gp.id = ep.guest_profile_id
  left join public.user_profiles up
    on up.user_id = cm.user_id
  where ep.event_id = p_event_id
    and e.is_deleted = false
    and (
      (public.is_club_record_event_participant(p_event_id) and e.status <> 'cancelled')
      or exists (
        select 1
        from public.club_members own
        where own.club_id = e.club_id
          and own.user_id = auth.uid()
          and own.is_active = true
          and own.role in ('owner', 'manager')
      )
    )
  order by ep.created_at asc;
$$;

alter function public.get_club_record_event_participants(uuid)
  owner to postgres;

-- Re-grant (CREATE OR REPLACE drops grants when signature changes).
grant execute on function public.get_club_record_event_participants(uuid)
  to authenticated;
