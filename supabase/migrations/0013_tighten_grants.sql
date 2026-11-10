-- 0013: functions from 0012 that only run inside the database (a trigger and a helper used by
-- other functions) shouldn't be callable through the API.
revoke execute on function public.guard_contact() from public, anon, authenticated;
revoke execute on function public.is_designer(uuid) from public, anon, authenticated;
