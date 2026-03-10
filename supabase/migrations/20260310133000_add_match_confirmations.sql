create type public.match_confirmation_decision as enum ('pending', 'approved', 'rejected');

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

create index if not exists idx_match_confirmations_match on public.match_confirmations(match_id);
create index if not exists idx_match_confirmations_user on public.match_confirmations(user_id);

drop trigger if exists match_confirmations_set_updated_at on public.match_confirmations;
create trigger match_confirmations_set_updated_at
before update on public.match_confirmations
for each row execute function public.set_updated_at();

alter table public.match_confirmations enable row level security;

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

update public.match_confirmations mc
set user_id = cm.user_id
from public.club_members cm
where cm.id = mc.club_member_id
  and mc.user_id is null;
