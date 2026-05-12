revoke all on function public.sync_club_record_members(uuid) from public;
revoke all on function public.sync_club_record_members(uuid) from anon;

grant execute on function public.sync_club_record_members(uuid) to authenticated;
grant execute on function public.sync_club_record_members(uuid) to service_role;
