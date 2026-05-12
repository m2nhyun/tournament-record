do $$
begin
  create type public.club_record_event_status as enum (
    'draft',
    'open',
    'in_progress',
    'completed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.club_record_participant_type as enum ('member', 'guest');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.club_record_attendance_status as enum ('registered', 'checked_in');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.club_record_slot_status as enum (
    'scheduled',
    'ready',
    'completed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.club_record_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text,
  event_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  court_count integer not null,
  status public.club_record_event_status not null default 'draft',
  assignment_dirty boolean not null default false,
  last_assignment_run_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (court_count >= 1),
  check (starts_at < ends_at)
);

create table if not exists public.club_record_guest_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  event_id uuid not null references public.club_record_events(id) on delete cascade,
  code text not null,
  issued_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id),
  unique (code)
);

create table if not exists public.club_record_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.club_record_events(id) on delete cascade,
  participant_type public.club_record_participant_type not null,
  club_member_id uuid references public.club_members(id) on delete cascade,
  guest_profile_id uuid references public.club_record_guest_profiles(id) on delete cascade,
  arrival_time timestamptz,
  attendance_status public.club_record_attendance_status not null default 'registered',
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, club_member_id),
  unique (event_id, guest_profile_id),
  check (
    (participant_type = 'member' and club_member_id is not null and guest_profile_id is null)
    or
    (participant_type = 'guest' and guest_profile_id is not null and club_member_id is null)
  )
);

create table if not exists public.club_record_event_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.club_record_events(id) on delete cascade,
  court_number integer not null,
  slot_order integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.club_record_slot_status not null default 'scheduled',
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, court_number, slot_order),
  check (court_number >= 1),
  check (slot_order >= 1),
  check (starts_at < ends_at)
);

create index if not exists club_record_events_club_date_idx
  on public.club_record_events (club_id, event_date);

create index if not exists club_record_events_club_status_idx
  on public.club_record_events (club_id, status);

create index if not exists club_record_events_visible_idx
  on public.club_record_events (club_id, is_deleted, event_date desc);

create index if not exists club_record_event_participants_event_type_idx
  on public.club_record_event_participants (event_id, participant_type);

create index if not exists club_record_event_participants_event_arrival_idx
  on public.club_record_event_participants (event_id, arrival_time);

create index if not exists club_record_event_slots_event_starts_at_idx
  on public.club_record_event_slots (event_id, starts_at);

drop trigger if exists club_record_events_set_updated_at on public.club_record_events;
create trigger club_record_events_set_updated_at
before update on public.club_record_events
for each row execute function public.set_updated_at();

drop trigger if exists club_record_event_participants_set_updated_at on public.club_record_event_participants;
create trigger club_record_event_participants_set_updated_at
before update on public.club_record_event_participants
for each row execute function public.set_updated_at();

drop trigger if exists club_record_guest_invites_set_updated_at on public.club_record_guest_invites;
create trigger club_record_guest_invites_set_updated_at
before update on public.club_record_guest_invites
for each row execute function public.set_updated_at();

drop trigger if exists club_record_event_slots_set_updated_at on public.club_record_event_slots;
create trigger club_record_event_slots_set_updated_at
before update on public.club_record_event_slots
for each row execute function public.set_updated_at();
