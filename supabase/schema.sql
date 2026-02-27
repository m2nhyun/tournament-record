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

drop policy if exists audit_logs_insert_member on public.audit_logs;
create policy audit_logs_insert_member
on public.audit_logs for insert
to authenticated
with check (
  public.is_club_member(club_id)
  and actor_user_id = auth.uid()
);
