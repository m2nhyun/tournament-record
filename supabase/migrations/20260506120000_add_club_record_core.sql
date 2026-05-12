do $$
begin
  create type public.club_record_group_code as enum ('A', 'B', 'C');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.club_record_settings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  group_a_percent integer not null default 20,
  group_b_percent integer not null default 30,
  group_c_percent integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id),
  check (group_a_percent >= 0),
  check (group_b_percent >= 0),
  check (group_c_percent >= 0),
  check (group_a_percent + group_b_percent + group_c_percent = 100)
);

create table if not exists public.club_record_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  club_member_id uuid not null references public.club_members(id) on delete cascade,
  ranking_position integer not null,
  group_code public.club_record_group_code not null,
  attendance_count integer not null default 0,
  match_count integer not null default 0,
  joined_on date,
  operator_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_member_id),
  unique (club_id, ranking_position),
  check (ranking_position >= 1),
  check (attendance_count >= 0),
  check (match_count >= 0)
);

create table if not exists public.club_record_guest_profiles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete restrict,
  display_name text,
  gender text,
  career_text text,
  group_code public.club_record_group_code,
  operator_note text,
  linked_club_member_id uuid references public.club_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, guest_user_id)
);

create table if not exists public.club_record_ranking_audits (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  target_club_member_id uuid not null references public.club_members(id) on delete cascade,
  before_ranking_position integer,
  after_ranking_position integer not null,
  before_group_code public.club_record_group_code,
  after_group_code public.club_record_group_code,
  changed_by uuid not null references auth.users(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  check (after_ranking_position >= 1)
);

create index if not exists club_record_members_club_ranking_idx
  on public.club_record_members (club_id, ranking_position);

create index if not exists club_record_members_club_group_idx
  on public.club_record_members (club_id, group_code);

create index if not exists club_record_ranking_audits_club_created_idx
  on public.club_record_ranking_audits (club_id, created_at desc);

create index if not exists club_record_ranking_audits_target_created_idx
  on public.club_record_ranking_audits (target_club_member_id, created_at desc);

drop trigger if exists club_record_settings_set_updated_at on public.club_record_settings;
create trigger club_record_settings_set_updated_at
before update on public.club_record_settings
for each row execute function public.set_updated_at();

drop trigger if exists club_record_members_set_updated_at on public.club_record_members;
create trigger club_record_members_set_updated_at
before update on public.club_record_members
for each row execute function public.set_updated_at();

drop trigger if exists club_record_guest_profiles_set_updated_at on public.club_record_guest_profiles;
create trigger club_record_guest_profiles_set_updated_at
before update on public.club_record_guest_profiles
for each row execute function public.set_updated_at();
