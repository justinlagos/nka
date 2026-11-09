-- When a plan changes (an upgrade from Stripe, or the studio setting Flex), start queued work that now fits.
create or replace function public.orgs_plan_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.plan, new.plan_status, new.active_limit) is distinct from (old.plan, old.plan_status, old.active_limit) then
    perform public.promote_queue(new.id);
  end if;
  return new;
end $$;

revoke execute on function public.orgs_plan_changed() from public, anon, authenticated;

create trigger orgs_plan_change
  after update of plan, plan_status, active_limit on public.orgs
  for each row execute function public.orgs_plan_changed();
