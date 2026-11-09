-- Whether the signed-in person has demo answers waiting to become a workspace.
create or replace function public.pending_demo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.demo_requests d join public.profiles p on p.id = auth.uid()
    where d.email = p.email and d.set_up_at is null and d.created_at > now() - interval '2 days')
$$;
revoke execute on function public.pending_demo() from public, anon;
grant execute on function public.pending_demo() to authenticated;
