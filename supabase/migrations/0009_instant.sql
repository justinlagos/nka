-- 0009: Instant (AI) briefs. The client chooses Instant or Designer when they send a brief.
-- Instant briefs don't use a plan slot, have a monthly cap per plan, and can be handed to a
-- designer to finish (the designer brief keeps a link to the chosen option).

alter table public.projects drop constraint projects_kind_check;
alter table public.projects add constraint projects_kind_check check (kind in ('brief', 'resize', 'instant'));

-- Instant briefs a month, by plan. Change the numbers here.
create or replace function public.instant_limit(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select case
    when o.plan = 'studio' and o.plan_status in ('active', 'trialing') then 60
    when o.plan = 'growth' and o.plan_status in ('active', 'trialing') then 30
    when o.plan = 'starter' and o.plan_status in ('active', 'trialing') then 15
    when o.plan in ('flex', 'bespoke') then 30
    else 2 end
  from public.orgs o where o.id = p_org
$$;

create or replace function public.instant_used(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.projects
  where org_id = p_org and kind = 'instant' and submitted_at >= date_trunc('month', now())
$$;

-- Sends a draft brief down the Instant lane: it starts at once and the server makes the options.
create or replace function public.start_instant(p_project uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  v_limit int;
  v_used int;
begin
  select * into v from public.projects where id = p_project for update;
  if not found or not public.can_edit_org(v.org_id) then raise exception 'Brief not found.' using errcode = '42501'; end if;
  if v.status <> 'draft' then raise exception 'This brief has already been sent.' using errcode = '22023'; end if;
  if coalesce(v.brief->>'summary', '') = '' then raise exception 'Describe what you need first.' using errcode = '22023'; end if;
  v_limit := public.instant_limit(v.org_id);
  v_used := public.instant_used(v.org_id);
  if v_used >= v_limit then
    raise exception 'You''ve used all % instant briefs this month. Send it to your designer instead.', v_limit using errcode = '22023';
  end if;
  update public.projects set
    kind = 'instant', status = 'in_progress', submitted_at = now(), approved_at = now(), approved_by = auth.uid(),
    estimate_amount = 0, estimate_notes = 'Instant: made by AI in your brand. A designer can finish any option.',
    estimate_sent_at = now(), concepts_status = 'pending'
  where id = p_project;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, auth.uid(), 'instant_started', '{}'::jsonb);
  return jsonb_build_object('used', v_used + 1, 'limit', v_limit);
end $$;

-- Hands an Instant option to a designer: a new designer brief that starts from the chosen file.
create or replace function public.finish_with_designer(p_deliverable uuid, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  d public.deliverables%rowtype;
  p public.projects%rowtype;
  v_id uuid;
begin
  select * into d from public.deliverables where id = p_deliverable;
  if not found or not public.can_edit_org(d.org_id) then raise exception 'File not found.' using errcode = '42501'; end if;
  select * into p from public.projects where id = d.project_id;
  insert into public.projects (org_id, title, service, kind, source_deliverable, brief, created_by)
  values (
    d.org_id, left('Finish: ' || p.title, 200), p.service, 'brief', d.id,
    p.brief || jsonb_build_object(
      'summary', 'Take the instant option "' || d.title || '" and finish it properly. ' || coalesce(p.brief->>'summary', ''),
      'references', trim(both from concat_ws(E'\n', nullif(trim(coalesce(p_note, '')), ''), 'Starting point: ' || d.title || ' from ' || p.title))),
    auth.uid())
  returning id into v_id;
  return v_id;
end $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('start_instant', 'finish_with_designer', 'instant_limit', 'instant_used')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
