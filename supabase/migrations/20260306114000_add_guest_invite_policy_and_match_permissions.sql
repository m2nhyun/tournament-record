alter type public.club_member_role add value if not exists 'guest';

alter table public.clubs
  add column if not exists invite_expires_at timestamptz;

update public.clubs
set invite_expires_at = coalesce(invite_expires_at, now() + interval '30 days');

alter table public.clubs
  alter column invite_expires_at set default (now() + interval '30 days'),
  alter column invite_expires_at set not null;

create or replace function public.generate_invite_code_unique()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_exists boolean;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    select exists(select 1 from public.clubs c where c.invite_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;

  return v_code;
end;
$$;

create or replace function public.regenerate_club_invite_code(
  p_club_id uuid,
  p_days_valid int default 30
)
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_days int := greatest(1, least(90, coalesce(p_days_valid, 30)));
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = v_user_id
      and cm.role = 'owner'
  ) then
    raise exception 'Only owner can regenerate invite code';
  end if;

  update public.clubs c
  set
    invite_code = public.generate_invite_code_unique(),
    invite_expires_at = now() + make_interval(days => v_days)
  where c.id = p_club_id
  returning c.invite_code, c.invite_expires_at
  into invite_code, invite_expires_at;

  if invite_code is null then
    raise exception 'Club not found';
  end if;

  return next;
end;
$$;

grant execute on function public.regenerate_club_invite_code(uuid, int) to authenticated;

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
    and invite_expires_at > now()
  limit 1;

  if v_club_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.club_members (club_id, user_id, role, nickname)
  values (v_club_id, v_user_id, 'member', trim(p_nickname))
  on conflict (club_id, user_id)
  do update
    set nickname = excluded.nickname,
        role = case
          when public.club_members.role in ('owner', 'manager', 'member') then public.club_members.role
          else 'member'
        end;

  return v_club_id;
end;
$$;

grant execute on function public.join_club_by_invite(text, text) to authenticated;

create or replace function public.join_club_by_invite_as_guest(
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
    and invite_expires_at > now()
  limit 1;

  if v_club_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.club_members (club_id, user_id, role, nickname)
  values (v_club_id, v_user_id, 'guest', trim(p_nickname))
  on conflict (club_id, user_id)
  do update
    set nickname = excluded.nickname,
        role = case
          when public.club_members.role in ('owner', 'manager', 'member') then public.club_members.role
          else 'guest'
        end;

  return v_club_id;
end;
$$;

grant execute on function public.join_club_by_invite_as_guest(text, text) to authenticated;

create or replace function public.can_manage_match(
  p_club_id uuid,
  p_created_by uuid
)
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
      and cm.role in ('owner', 'manager')
  )
  or (auth.uid() = p_created_by);
$$;

drop policy if exists matches_insert_member on public.matches;
create policy matches_insert_member
on public.matches for insert
to authenticated
with check (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = matches.club_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'manager', 'member')
  )
  and created_by = auth.uid()
);

drop policy if exists matches_update_member on public.matches;
create policy matches_update_member
on public.matches for update
to authenticated
using (public.can_manage_match(club_id, created_by))
with check (public.can_manage_match(club_id, created_by));

drop policy if exists match_players_manage_member on public.match_players;
create policy match_players_manage_member
on public.match_players for all
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.can_manage_match(m.club_id, m.created_by)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.can_manage_match(m.club_id, m.created_by)
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
      and public.can_manage_match(m.club_id, m.created_by)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.can_manage_match(m.club_id, m.created_by)
  )
);

notify pgrst, 'reload schema';
