do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'match_schedule_format'
  ) then
    create type public.match_schedule_format as enum (
      'men_doubles',
      'women_doubles',
      'open_doubles'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'match_schedule_status'
  ) then
    create type public.match_schedule_status as enum (
      'open',
      'full',
      'cancelled'
    );
  end if;
end $$;

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
  location text not null check (char_length(btrim(location)) between 2 and 80),
  court_fee integer not null default 0 check (court_fee >= 0),
  ball_fee integer not null default 0 check (ball_fee >= 0),
  capacity smallint not null check (capacity between 2 and 8),
  notes text not null default '' check (char_length(notes) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create index if not exists idx_match_schedules_club_scheduled_at
  on public.match_schedules(club_id, scheduled_at asc);

create index if not exists idx_match_schedule_participants_schedule
  on public.match_schedule_participants(schedule_id, created_at asc);

drop trigger if exists match_schedules_set_updated_at on public.match_schedules;
create trigger match_schedules_set_updated_at
before update on public.match_schedules
for each row execute function public.set_updated_at();

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
      and cm.is_active = true
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

  if v_capacity is null then
    return;
  end if;

  if v_status = 'cancelled' then
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
  p_location text,
  p_court_fee integer default 0,
  p_ball_fee integer default 0,
  p_capacity integer default 4,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_host_member_id uuid;
  v_host_role public.club_member_role;
  v_schedule_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select cm.id, cm.role
    into v_host_member_id, v_host_role
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.user_id = v_user_id
    and cm.is_active = true
  limit 1;

  if v_host_member_id is null then
    raise exception '클럽 멤버만 일정을 생성할 수 있습니다.';
  end if;

  if v_host_role = 'guest' then
    raise exception '게스트는 일정을 생성할 수 없습니다.';
  end if;

  if p_scheduled_at <= now() then
    raise exception '일정은 현재 이후 시간으로 등록해주세요.';
  end if;

  insert into public.match_schedules (
    club_id,
    host_member_id,
    created_by,
    format,
    status,
    scheduled_at,
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
    coalesce(p_format, 'open_doubles'),
    'open',
    p_scheduled_at,
    trim(p_location),
    greatest(0, coalesce(p_court_fee, 0)),
    greatest(0, coalesce(p_ball_fee, 0)),
    greatest(2, least(8, coalesce(p_capacity, 4))),
    left(coalesce(trim(p_notes), ''), 240)
  )
  returning id
  into v_schedule_id;

  insert into public.match_schedule_participants (
    schedule_id,
    club_member_id,
    joined_by
  )
  values (
    v_schedule_id,
    v_host_member_id,
    v_user_id
  );

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

  if v_schedule.status = 'cancelled' then
    raise exception '취소된 일정에는 참가할 수 없습니다.';
  end if;

  select cm.id
    into v_member_id
  from public.club_members cm
  where cm.club_id = v_schedule.club_id
    and cm.user_id = v_user_id
    and cm.is_active = true
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

  insert into public.match_schedule_participants (
    schedule_id,
    club_member_id,
    joined_by
  )
  values (
    p_schedule_id,
    v_member_id,
    v_user_id
  );

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
    and cm.is_active = true
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

alter table public.match_schedules enable row level security;
alter table public.match_schedule_participants enable row level security;

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

grant execute on function public.create_match_schedule(
  uuid,
  public.match_schedule_format,
  timestamptz,
  text,
  integer,
  integer,
  integer,
  text
) to authenticated;

grant execute on function public.join_match_schedule(uuid) to authenticated;
grant execute on function public.leave_match_schedule(uuid) to authenticated;
grant execute on function public.refresh_match_schedule_status(uuid) to authenticated;

notify pgrst, 'reload schema';
