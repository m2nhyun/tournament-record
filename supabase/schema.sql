-- Tournament Record MVP schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.club_member_role as enum ('owner', 'manager', 'member');

create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.club_member_role not null default 'member',
  nickname text not null,
  created_at timestamptz not null default now(),
  unique(club_id, user_id)
);

create type public.match_type as enum ('singles', 'doubles');
create type public.match_status as enum ('draft', 'submitted', 'confirmed', 'disputed');
create type public.match_confirmation_decision as enum ('pending', 'approved', 'rejected');
create type public.match_schedule_format as enum ('men_doubles', 'women_doubles', 'open_doubles');
create type public.match_schedule_status as enum ('open', 'full', 'cancelled');

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  match_type public.match_type not null,
  status public.match_status not null default 'draft',
  played_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  club_member_id uuid not null references public.club_members(id) on delete restrict,
  side smallint not null check (side in (1, 2)),
  position smallint check (position in (1, 2)),
  created_at timestamptz not null default now(),
  unique(match_id, club_member_id)
);

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  score_summary text not null,
  set_scores jsonb not null default '[]'::jsonb,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_confirmations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  club_member_id uuid not null references public.club_members(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  side smallint not null check (side in (1, 2)),
  decision public.match_confirmation_decision not null default 'pending',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(match_id, club_member_id)
);

create table if not exists public.match_schedules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  host_member_id uuid not null
    constraint match_schedules_host_member_id_fkey
    references public.club_members(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  linked_match_id uuid unique references public.matches(id) on delete set null,
  format public.match_schedule_format not null default 'open_doubles',
  status public.match_schedule_status not null default 'open',
  scheduled_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null check (char_length(btrim(location)) between 2 and 80),
  court_fee integer not null default 0 check (court_fee >= 0),
  ball_fee integer not null default 0 check (ball_fee >= 0),
  capacity smallint not null check (capacity between 2 and 8),
  notes text not null default '' check (char_length(notes) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_schedules_ends_at_after_scheduled_at check (ends_at > scheduled_at)
);

create table if not exists public.match_schedule_participants (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.match_schedules(id) on delete cascade,
  club_member_id uuid not null
    constraint match_schedule_participants_club_member_id_fkey
    references public.club_members(id) on delete restrict,
  joined_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(schedule_id, club_member_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_club_members_club on public.club_members(club_id);
create index if not exists idx_matches_club_played_at on public.matches(club_id, played_at desc);
create index if not exists idx_match_players_match on public.match_players(match_id);
create index if not exists idx_match_confirmations_match on public.match_confirmations(match_id);
create index if not exists idx_match_schedules_club_scheduled_at on public.match_schedules(club_id, scheduled_at asc);
create index if not exists idx_match_schedule_participants_schedule on public.match_schedule_participants(schedule_id, created_at asc);
create index if not exists idx_audit_logs_club_created_at on public.audit_logs(club_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clubs_set_updated_at on public.clubs;
create trigger clubs_set_updated_at
before update on public.clubs
for each row execute function public.set_updated_at();

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists match_results_set_updated_at on public.match_results;
create trigger match_results_set_updated_at
before update on public.match_results
for each row execute function public.set_updated_at();

drop trigger if exists match_confirmations_set_updated_at on public.match_confirmations;
create trigger match_confirmations_set_updated_at
before update on public.match_confirmations
for each row execute function public.set_updated_at();

drop trigger if exists match_schedules_set_updated_at on public.match_schedules;
create trigger match_schedules_set_updated_at
before update on public.match_schedules
for each row execute function public.set_updated_at();

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
      and cm.role in ('owner', 'manager')
  );
$$;

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_results enable row level security;
alter table public.match_confirmations enable row level security;
alter table public.match_schedules enable row level security;
alter table public.match_schedule_participants enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists clubs_select_member on public.clubs;
create policy clubs_select_member
on public.clubs for select
to authenticated
using (public.is_club_member(id) or created_by = auth.uid());

drop policy if exists clubs_insert_authenticated on public.clubs;
create policy clubs_insert_authenticated
on public.clubs for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists clubs_update_admin on public.clubs;
create policy clubs_update_admin
on public.clubs for update
to authenticated
using (public.is_club_admin(id))
with check (public.is_club_admin(id));

drop policy if exists club_members_select_member on public.club_members;
create policy club_members_select_member
on public.club_members for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists club_members_manage_admin on public.club_members;
create policy club_members_manage_admin
on public.club_members for all
to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists club_members_insert_owner_bootstrap on public.club_members;
create policy club_members_insert_owner_bootstrap
on public.club_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.clubs c
    where c.id = club_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists matches_select_member on public.matches;
create policy matches_select_member
on public.matches for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists matches_insert_member on public.matches;
create policy matches_insert_member
on public.matches for insert
to authenticated
with check (
  public.is_club_member(club_id)
  and created_by = auth.uid()
);

drop policy if exists matches_update_member on public.matches;
create policy matches_update_member
on public.matches for update
to authenticated
using (public.is_club_member(club_id))
with check (public.is_club_member(club_id));

drop policy if exists matches_delete_member on public.matches;
create policy matches_delete_member
on public.matches for delete
to authenticated
using (public.can_manage_match(club_id, created_by));

drop policy if exists match_players_select_member on public.match_players;
create policy match_players_select_member
on public.match_players for select
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_club_member(m.club_id)
  )
);

drop policy if exists match_players_manage_member on public.match_players;
create policy match_players_manage_member
on public.match_players for all
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_club_member(m.club_id)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_club_member(m.club_id)
  )
);

drop policy if exists match_results_select_member on public.match_results;
create policy match_results_select_member
on public.match_results for select
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_club_member(m.club_id)
  )
);

drop policy if exists match_results_manage_member on public.match_results;
create policy match_results_manage_member
on public.match_results for all
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_club_member(m.club_id)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_club_member(m.club_id)
  )
);

drop policy if exists audit_logs_select_member on public.audit_logs;
create policy audit_logs_select_member
on public.audit_logs for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists match_schedules_select_member on public.match_schedules;
create policy match_schedules_select_member
on public.match_schedules for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists match_schedule_participants_select_member on public.match_schedule_participants;
create policy match_schedule_participants_select_member
on public.match_schedule_participants for select
to authenticated
using (
  exists (
    select 1
    from public.match_schedules ms
    where ms.id = schedule_id
      and public.is_club_member(ms.club_id)
  )
);

drop policy if exists match_confirmations_select_member on public.match_confirmations;
create policy match_confirmations_select_member
on public.match_confirmations for select
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_club_member(m.club_id)
  )
);

drop policy if exists match_confirmations_insert_manager on public.match_confirmations;
create policy match_confirmations_insert_manager
on public.match_confirmations for insert
to authenticated
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.can_manage_match(m.club_id, m.created_by)
  )
);

drop policy if exists match_confirmations_delete_manager on public.match_confirmations;
create policy match_confirmations_delete_manager
on public.match_confirmations for delete
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.can_manage_match(m.club_id, m.created_by)
  )
);

drop policy if exists match_confirmations_update_target_user on public.match_confirmations;
create policy match_confirmations_update_target_user
on public.match_confirmations for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists audit_logs_insert_member on public.audit_logs;
create policy audit_logs_insert_member
on public.audit_logs for insert
to authenticated
with check (
  public.is_club_member(club_id)
  and actor_user_id = auth.uid()
);

create or replace function public.can_create_match_schedule(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'manager', 'member')
  );
$$;

create or replace function public.refresh_match_schedule_status(p_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity smallint;
  v_status public.match_schedule_status;
  v_participant_count integer;
begin
  select capacity, status
    into v_capacity, v_status
  from public.match_schedules
  where id = p_schedule_id;

  if v_capacity is null or v_status = 'cancelled' then
    return;
  end if;

  select count(*)
    into v_participant_count
  from public.match_schedule_participants
  where schedule_id = p_schedule_id;

  update public.match_schedules
  set status = case
    when v_participant_count >= v_capacity then 'full'
    else 'open'
  end
  where id = p_schedule_id;
end;
$$;

create or replace function public.create_match_schedule(
  p_club_id uuid,
  p_format public.match_schedule_format,
  p_scheduled_at timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_court_fee integer default 0,
  p_ball_fee integer default 0,
  p_capacity integer default 4,
  p_notes text default '',
  p_include_host boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_host_member_id uuid;
  v_schedule_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select cm.id
    into v_host_member_id
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.user_id = v_user_id
  limit 1;

  if v_host_member_id is null then
    raise exception '클럽 멤버만 일정을 생성할 수 있습니다.';
  end if;

  if not public.can_create_match_schedule(p_club_id) then
    raise exception '게스트는 일정을 생성할 수 없습니다.';
  end if;

  if p_scheduled_at <= now() then
    raise exception '일정은 현재 이후 시간으로 등록해주세요.';
  end if;

  if p_ends_at <= p_scheduled_at then
    raise exception '종료 시간은 시작 시간보다 뒤여야 합니다.';
  end if;

  insert into public.match_schedules (
    club_id,
    host_member_id,
    created_by,
    format,
    status,
    scheduled_at,
    ends_at,
    location,
    court_fee,
    ball_fee,
    capacity,
    notes
  )
  values (
    p_club_id,
    v_host_member_id,
    v_user_id,
    p_format,
    'open',
    p_scheduled_at,
    p_ends_at,
    trim(p_location),
    greatest(0, coalesce(p_court_fee, 0)),
    greatest(0, coalesce(p_ball_fee, 0)),
    greatest(1, least(8, coalesce(p_capacity, 4))),
    left(coalesce(trim(p_notes), ''), 240)
  )
  returning id
  into v_schedule_id;

  if coalesce(p_include_host, true) then
    insert into public.match_schedule_participants (schedule_id, club_member_id, joined_by)
    values (v_schedule_id, v_host_member_id, v_user_id);
  end if;

  perform public.refresh_match_schedule_status(v_schedule_id);

  return v_schedule_id;
end;
$$;

create or replace function public.join_match_schedule(p_schedule_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_schedule record;
  v_participant_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.id, ms.club_id, ms.capacity, ms.status
    into v_schedule
  from public.match_schedules ms
  where ms.id = p_schedule_id
  for update;

  if v_schedule.id is null then
    raise exception '일정을 찾을 수 없습니다.';
  end if;

  select cm.id
    into v_member_id
  from public.club_members cm
  where cm.club_id = v_schedule.club_id
    and cm.user_id = v_user_id
  limit 1;

  if v_member_id is null then
    raise exception '클럽 멤버만 일정에 참가할 수 있습니다.';
  end if;

  if exists (
    select 1
    from public.match_schedule_participants msp
    where msp.schedule_id = p_schedule_id
      and msp.club_member_id = v_member_id
  ) then
    return p_schedule_id;
  end if;

  select count(*)
    into v_participant_count
  from public.match_schedule_participants
  where schedule_id = p_schedule_id;

  if v_participant_count >= v_schedule.capacity then
    raise exception '정원이 모두 찼습니다.';
  end if;

  insert into public.match_schedule_participants (schedule_id, club_member_id, joined_by)
  values (p_schedule_id, v_member_id, v_user_id);

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;

create or replace function public.leave_match_schedule(p_schedule_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_host_member_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.host_member_id, cm.id
    into v_host_member_id, v_member_id
  from public.match_schedules ms
  join public.club_members cm
    on cm.club_id = ms.club_id
  where ms.id = p_schedule_id
    and cm.user_id = v_user_id
  limit 1;

  if v_member_id is null then
    raise exception '참가 중인 일정이 아닙니다.';
  end if;

  if v_member_id = v_host_member_id then
    raise exception '개설자는 일정을 나갈 수 없습니다.';
  end if;

  delete from public.match_schedule_participants
  where schedule_id = p_schedule_id
    and club_member_id = v_member_id;

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;

grant execute on function public.create_match_schedule(
  uuid,
  public.match_schedule_format,
  timestamptz,
  timestamptz,
  text,
  integer,
  integer,
  integer,
  text,
  boolean
) to authenticated;

grant execute on function public.join_match_schedule(uuid) to authenticated;
grant execute on function public.leave_match_schedule(uuid) to authenticated;
grant execute on function public.refresh_match_schedule_status(uuid) to authenticated;

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
