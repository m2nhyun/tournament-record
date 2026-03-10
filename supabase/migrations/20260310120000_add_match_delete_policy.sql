create policy matches_delete_member
on public.matches for delete
to authenticated
using (public.can_manage_match(club_id, created_by));

notify pgrst, 'reload schema';
