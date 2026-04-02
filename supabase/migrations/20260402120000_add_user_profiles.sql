create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 2 and 24),
  gender text check (gender is null or gender in ('male', 'female', 'unspecified')),
  profile_completed boolean not null default false,
  auth_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_completed_requires_fields check (
    not profile_completed
    or (
      display_name is not null
      and char_length(btrim(display_name)) between 2 and 24
      and gender in ('male', 'female', 'unspecified')
    )
  )
);

create index if not exists idx_user_profiles_user_id on public.user_profiles(user_id);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
on public.user_profiles for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own
on public.user_profiles for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own
on public.user_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
