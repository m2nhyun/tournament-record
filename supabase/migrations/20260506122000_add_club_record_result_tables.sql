do $$
begin
  create type public.club_record_match_status as enum (
    'pending_result',
    'confirmed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.club_record_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.club_record_events(id) on delete cascade,
  slot_id uuid not null references public.club_record_event_slots(id) on delete cascade,
  status public.club_record_match_status not null default 'pending_result',
  assignment_mode text not null,
  is_manual boolean not null default false,
  result_entered_by uuid references auth.users(id) on delete restrict,
  result_entered_at timestamptz,
  confirmed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id),
  check (assignment_mode in ('auto', 'manual'))
);

create table if not exists public.club_record_match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.club_record_matches(id) on delete cascade,
  participant_id uuid not null references public.club_record_event_participants(id) on delete cascade,
  side integer not null,
  position integer not null,
  created_at timestamptz not null default now(),
  unique (match_id, participant_id),
  unique (match_id, side, position),
  check (side in (1, 2)),
  check (position in (1, 2))
);

create table if not exists public.club_record_match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.club_record_matches(id) on delete cascade,
  winning_side integer,
  losing_side integer,
  is_draw boolean not null default false,
  score_text text not null,
  entered_by_participant_id uuid references public.club_record_event_participants(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id),
  check (btrim(score_text) <> ''),
  check (
    (is_draw = true and winning_side is null and losing_side is null)
    or
    (is_draw = false and winning_side in (1, 2) and losing_side in (1, 2) and winning_side <> losing_side)
  )
);

create index if not exists club_record_matches_event_status_idx
  on public.club_record_matches (event_id, status);

create index if not exists club_record_match_players_participant_idx
  on public.club_record_match_players (participant_id);

drop trigger if exists club_record_matches_set_updated_at on public.club_record_matches;
create trigger club_record_matches_set_updated_at
before update on public.club_record_matches
for each row execute function public.set_updated_at();

drop trigger if exists club_record_match_results_set_updated_at on public.club_record_match_results;
create trigger club_record_match_results_set_updated_at
before update on public.club_record_match_results
for each row execute function public.set_updated_at();
