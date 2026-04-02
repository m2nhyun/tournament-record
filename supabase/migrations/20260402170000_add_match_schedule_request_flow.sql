do $$
begin
  create type public.match_schedule_join_policy as enum ('instant', 'approval_required');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.match_schedule_request_status as enum (
    'pending',
    'accepted',
    'rejected',
    'cancelled_by_user'
  );
exception
  when duplicate_object then null;
end $$;

alter type public.match_schedule_status add value if not exists 'reviewing';

alter table public.match_schedules
  add column if not exists join_policy public.match_schedule_join_policy not null default 'instant';

create table if not exists public.match_schedule_requests (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.match_schedules(id) on delete cascade,
  club_member_id uuid not null references public.club_members(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status public.match_schedule_request_status not null default 'pending',
  message text not null default '' check (char_length(message) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, club_member_id)
);

create index if not exists idx_match_schedule_requests_schedule_status
  on public.match_schedule_requests(schedule_id, status);

create index if not exists idx_match_schedule_requests_requested_by
  on public.match_schedule_requests(requested_by, created_at desc);

drop trigger if exists match_schedule_requests_set_updated_at on public.match_schedule_requests;
create trigger match_schedule_requests_set_updated_at
before update on public.match_schedule_requests
for each row execute function public.set_updated_at();

alter table public.match_schedule_requests enable row level security;

drop policy if exists match_schedule_requests_select_member on public.match_schedule_requests;
create policy match_schedule_requests_select_member
on public.match_schedule_requests for select
to authenticated
using (
  exists (
    select 1
    from public.match_schedules ms
    where ms.id = schedule_id
      and public.is_club_member(ms.club_id)
  )
);

drop function if exists public.create_match_schedule(
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
);

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
  p_include_host boolean default true,
  p_join_policy public.match_schedule_join_policy default 'instant'
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
    and cm.is_active = true
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
    join_policy,
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
    coalesce(p_join_policy, 'instant'),
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

create or replace function public.request_match_schedule(
  p_schedule_id uuid,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_member_role public.club_member_role;
  v_schedule record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.id, ms.club_id, ms.capacity, ms.status, ms.join_policy, ms.host_member_id
    into v_schedule
  from public.match_schedules ms
  where ms.id = p_schedule_id
  for update;

  if v_schedule.id is null then
    raise exception '일정을 찾을 수 없습니다.';
  end if;

  if v_schedule.status = 'cancelled' then
    raise exception '취소된 일정에는 신청할 수 없습니다.';
  end if;

  if v_schedule.join_policy <> 'approval_required' then
    raise exception '바로 참가형 일정입니다. 신청 대신 바로 참가를 사용해주세요.';
  end if;

  select cm.id, cm.role
    into v_member_id, v_member_role
  from public.club_members cm
  where cm.club_id = v_schedule.club_id
    and cm.user_id = v_user_id
    and cm.is_active = true
  limit 1;

  if v_member_id is null then
    raise exception '클럽 멤버만 일정에 신청할 수 있습니다.';
  end if;

  if v_member_role = 'guest' then
    raise exception '게스트는 승인형 모집에 신청할 수 없습니다.';
  end if;

  if v_member_id = v_schedule.host_member_id then
    raise exception '개설자는 자신의 일정에 신청할 수 없습니다.';
  end if;

  if exists (
    select 1
    from public.match_schedule_participants msp
    where msp.schedule_id = p_schedule_id
      and msp.club_member_id = v_member_id
  ) then
    return p_schedule_id;
  end if;

  insert into public.match_schedule_requests (
    schedule_id,
    club_member_id,
    requested_by,
    status,
    message
  )
  values (
    p_schedule_id,
    v_member_id,
    v_user_id,
    'pending',
    left(coalesce(trim(p_message), ''), 120)
  )
  on conflict (schedule_id, club_member_id)
  do update
    set requested_by = excluded.requested_by,
        status = 'pending',
        message = excluded.message,
        updated_at = now();

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;

create or replace function public.cancel_match_schedule_request(
  p_schedule_id uuid
)
returns uuid
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

  update public.match_schedule_requests
  set status = 'cancelled_by_user',
      updated_at = now()
  where schedule_id = p_schedule_id
    and requested_by = v_user_id
    and status = 'pending';

  if not found then
    raise exception '취소할 신청이 없습니다.';
  end if;

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;

create or replace function public.accept_match_schedule_request(
  p_schedule_id uuid,
  p_club_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_schedule record;
  v_participant_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ms.id, ms.club_id, ms.capacity, ms.status, ms.host_member_id
    into v_schedule
  from public.match_schedules ms
  where ms.id = p_schedule_id
  for update;

  if v_schedule.id is null then
    raise exception '일정을 찾을 수 없습니다.';
  end if;

  if not (
    public.is_club_admin(v_schedule.club_id)
    or exists (
      select 1
      from public.club_members cm
      where cm.id = v_schedule.host_member_id
        and cm.user_id = v_user_id
        and cm.is_active = true
    )
  ) then
    raise exception '신청을 검토할 권한이 없습니다.';
  end if;

  if v_schedule.status = 'cancelled' then
    raise exception '취소된 일정입니다.';
  end if;

  if not exists (
    select 1
    from public.match_schedule_requests msr
    where msr.schedule_id = p_schedule_id
      and msr.club_member_id = p_club_member_id
      and msr.status = 'pending'
  ) then
    raise exception '대기 중인 신청이 없습니다.';
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
    p_club_member_id,
    v_user_id
  )
  on conflict (schedule_id, club_member_id) do nothing;

  update public.match_schedule_requests
  set status = 'accepted',
      updated_at = now()
  where schedule_id = p_schedule_id
    and club_member_id = p_club_member_id;

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;

create or replace function public.reject_match_schedule_request(
  p_schedule_id uuid,
  p_club_member_id uuid
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

  select ms.club_id
    into v_club_id
  from public.match_schedules ms
  where ms.id = p_schedule_id;

  if v_club_id is null then
    raise exception '일정을 찾을 수 없습니다.';
  end if;

  if not (
    public.is_club_admin(v_club_id)
    or exists (
      select 1
      from public.match_schedules ms
      join public.club_members cm
        on cm.id = ms.host_member_id
      where ms.id = p_schedule_id
        and cm.user_id = v_user_id
        and cm.is_active = true
    )
  ) then
    raise exception '신청을 검토할 권한이 없습니다.';
  end if;

  update public.match_schedule_requests
  set status = 'rejected',
      updated_at = now()
  where schedule_id = p_schedule_id
    and club_member_id = p_club_member_id
    and status = 'pending';

  if not found then
    raise exception '대기 중인 신청이 없습니다.';
  end if;

  perform public.refresh_match_schedule_status(p_schedule_id);

  return p_schedule_id;
end;
$$;

create or replace function public.refresh_match_schedule_status(
  p_schedule_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity smallint;
  v_status public.match_schedule_status;
  v_join_policy public.match_schedule_join_policy;
  v_participant_count integer;
  v_pending_request_count integer;
begin
  select capacity, status, join_policy
    into v_capacity, v_status, v_join_policy
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

  select count(*)
    into v_pending_request_count
  from public.match_schedule_requests
  where schedule_id = p_schedule_id
    and status = 'pending';

  update public.match_schedules
  set status = case
    when v_participant_count >= v_capacity then 'full'
    when v_join_policy = 'approval_required' and v_pending_request_count > 0 then 'reviewing'
    else 'open'
  end
  where id = p_schedule_id;
end;
$$;

grant all on function public.create_match_schedule(
  uuid,
  public.match_schedule_format,
  timestamptz,
  timestamptz,
  text,
  integer,
  integer,
  integer,
  text,
  boolean,
  public.match_schedule_join_policy
) to anon, authenticated, service_role;

grant all on function public.request_match_schedule(uuid, text) to anon, authenticated, service_role;
grant all on function public.cancel_match_schedule_request(uuid) to anon, authenticated, service_role;
grant all on function public.accept_match_schedule_request(uuid, uuid) to anon, authenticated, service_role;
grant all on function public.reject_match_schedule_request(uuid, uuid) to anon, authenticated, service_role;

grant all on table public.match_schedule_requests to anon, authenticated, service_role;
