-- Helpers are for policies and other functions, never for signed-out visitors.
revoke execute on function public.is_staff(), public.org_role(uuid), public.can_view_org(uuid),
  public.can_edit_org(uuid), public.can_admin_org(uuid) from public, anon;
grant execute on function public.is_staff(), public.org_role(uuid), public.can_view_org(uuid),
  public.can_edit_org(uuid), public.can_admin_org(uuid) to authenticated;

-- Trigger functions are never called directly.
revoke execute on function public.handle_new_user(), public.log_status_change() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

alter function public.try_uuid(text) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
