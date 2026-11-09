-- 0004: answers to the usual complaints about design subscriptions.
--   * One named designer per client, and a written handover if that ever changes.
--   * Resizes and versions of approved work are free and don't use a request slot.
--   * A paused plan queues new briefs instead of charging for them.
--   * Unused Flex budget can be paid back when a client leaves.
--   * Plan auto-start only for plans that are actually paid up.
--   * A signed-in person can see invites sent to their email, from any device.

-- ---------------------------------------------------------------------------
-- Named lead designer
-- ---------------------------------------------------------------------------

alter table public.orgs add column lead_id uuid references public.profiles(id) on delete set null;
alter table public.orgs add column lead_since timestamptz;

create table public.lead_changes (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  from_user uuid references public.profiles(id) on delete set null,
  to_user uuid references public.profiles(id) on delete set null,
  note text not null default '' check (char_length(note) <= 2000),
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_changes_org_idx on public.lead_changes(org_id, created_at);
alter table public.lead_changes enable row level security;
create policy lead_changes_select on public.lead_changes for select to authenticated using (public.can_view_org(org_id));

create or replace function public.staff_set_lead(p_org uuid, p_user uuid, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old uuid;
begin
  perform public.require_staff();
  select lead_id into v_old from public.orgs where id = p_org for update;
  if not found then raise exception 'Client not found.' using errcode = '22023'; end if;
  if p_user is not null and not exists (select 1 from public.profiles where id = p_user and is_staff) then
    raise exception 'Choose someone from the studio.' using errcode = '22023';
  end if;
  if v_old is not distinct from p_user then return; end if;
  if v_old is not null and coalesce(trim(p_note), '') = '' then
    raise exception 'Write a handover note for the client: why the change, and what the new designer has been told.'
      using errcode = '22023';
  end if;
  if char_length(coalesce(p_note, '')) > 2000 then raise exception 'Keep the note under 2,000 characters.' using errcode = '22023'; end if;
  update public.orgs set lead_id = p_user, lead_since = case when p_user is null then null else now() end where id = p_org;
  insert into public.lead_changes (org_id, from_user, to_user, note, changed_by)
    values (p_org, v_old, p_user, coalesce(trim(p_note), ''), auth.uid());
  -- Open work follows the lead unless someone else was deliberately put on it.
  update public.projects set assignee = p_user
    where org_id = p_org and status not in ('draft', 'completed', 'cancelled')
      and (assignee is null or assignee is not distinct from v_old);
end $$;

-- ---------------------------------------------------------------------------
-- Free resizes and versions
-- ---------------------------------------------------------------------------

alter table public.projects add column kind text not null default 'brief' check (kind in ('brief', 'resize'));
alter table public.projects add column source_deliverable uuid references public.deliverables(id) on delete set null;

-- Resizes never count against a plan's active-request limit.
create or replace function public.active_project_count(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.projects
  where org_id = p_org and kind = 'brief'
    and status in ('submitted', 'awaiting_approval', 'in_progress', 'in_review', 'changes_requested')
$$;

create or replace function public.request_resize(p_deliverable uuid, p_sizes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  d public.deliverables%rowtype;
  v_lead uuid;
  v_id uuid;
begin
  select * into d from public.deliverables where id = p_deliverable;
  if not found or not public.can_edit_org(d.org_id) then raise exception 'File not found.' using errcode = '42501'; end if;
  if d.status <> 'approved' then raise exception 'Resizes are for files you have approved.' using errcode = '22023'; end if;
  if coalesce(trim(p_sizes), '') = '' then raise exception 'List the sizes or versions you need.' using errcode = '22023'; end if;
  if char_length(p_sizes) > 2000 then raise exception 'Keep the list under 2,000 characters.' using errcode = '22023'; end if;
  select lead_id into v_lead from public.orgs where id = d.org_id;
  insert into public.projects (
    org_id, title, service, kind, source_deliverable, status, brief, submitted_at, approved_at, approved_by,
    estimate_amount, estimate_notes, estimate_sent_at, assignee, created_by)
  values (
    d.org_id, left('Resize: ' || d.title, 200), 'resizes', 'resize', d.id, 'in_progress',
    jsonb_build_object(
      'summary', 'New sizes or versions of "' || d.title || '" (version ' || d.version || ').',
      'deliverables', trim(p_sizes)),
    now(), now(), auth.uid(),
    0, 'Free. Resizes and versions of work we made for you are included.', now(), v_lead, auth.uid())
  returning id into v_id;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v_id, d.org_id, auth.uid(), 'resize_requested', jsonb_build_object('from', d.title, 'version', d.version));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Pause, and auto-start only for paid-up plans
-- ---------------------------------------------------------------------------

-- Paused: nothing new starts (cap of 0) until the plan resumes; work already started carries on.
create or replace function public.effective_limit(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select case
    when o.plan_status = 'paused' then 0
    when o.plan in ('starter', 'growth', 'studio') and o.plan_status in ('active', 'trialing') then o.active_limit
    else null end
  from public.orgs o where o.id = p_org
$$;

create or replace function public.submit_project(p_project uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  v_limit int;
  v_status text;
begin
  select * into v from public.projects where id = p_project for update;
  if not found or not public.can_edit_org(v.org_id) then
    raise exception 'Brief not found.' using errcode = '42501';
  end if;
  if v.status <> 'draft' then raise exception 'This brief has already been sent.' using errcode = '22023'; end if;
  if coalesce(v.brief->>'summary', '') = '' then
    raise exception 'Describe what you need before sending.' using errcode = '22023';
  end if;
  v_limit := public.effective_limit(v.org_id);
  v_status := case when v_limit is not null and public.active_project_count(v.org_id) >= v_limit
                   then 'queued' else 'submitted' end;
  update public.projects set
    status = v_status,
    submitted_at = now(),
    assignee = coalesce(assignee, (select lead_id from public.orgs where id = v.org_id))
  where id = p_project;
  return v_status;
end $$;

create or replace function public.staff_send_estimate(
  p_project uuid, p_amount numeric, p_hours numeric, p_due date, p_notes text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  o public.orgs%rowtype;
begin
  perform public.require_staff();
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found.' using errcode = '22023'; end if;
  if v.status not in ('submitted', 'awaiting_approval') then
    raise exception 'Estimates go on submitted projects. Once approved, the price is fixed.' using errcode = '22023';
  end if;
  select * into o from public.orgs where id = v.org_id;
  update public.projects set
    estimate_amount = p_amount, estimate_hours = p_hours, estimate_due = p_due,
    estimate_notes = coalesce(p_notes, ''), estimate_sent_at = now(), status = 'awaiting_approval'
  where id = p_project;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, auth.uid(), 'estimate_sent',
            jsonb_build_object('amount', p_amount, 'hours', p_hours, 'due', p_due));
  -- Paid-up plan clients go straight into production. So does anyone who ticked
  -- "start without waiting for my approval".
  if v.auto_approve or (o.plan in ('starter', 'growth', 'studio') and o.plan_status in ('active', 'trialing')) then
    perform public._approve_project(p_project, auth.uid());
    return 'in_progress';
  end if;
  return 'awaiting_approval';
end $$;

-- ---------------------------------------------------------------------------
-- Paying back unused Flex budget
-- ---------------------------------------------------------------------------

alter table public.budget_ledger drop constraint budget_ledger_kind_check;
alter table public.budget_ledger add constraint budget_ledger_kind_check
  check (kind in ('allocation', 'top_up', 'spend', 'refund', 'expiry', 'adjustment', 'payout'));

create or replace function public.staff_ledger_entry(
  p_org uuid, p_kind text, p_amount numeric, p_note text, p_project uuid default null, p_effective date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform public.require_staff();
  if p_kind in ('allocation', 'top_up', 'refund') and p_amount <= 0 then
    raise exception 'Credits must be positive.' using errcode = '22023';
  end if;
  if p_kind in ('spend', 'expiry', 'payout') and p_amount >= 0 then
    raise exception 'Spend, expiry and payouts must be negative.' using errcode = '22023';
  end if;
  insert into public.budget_ledger (org_id, kind, amount, project_id, note, effective_on, created_by)
    values (p_org, p_kind, p_amount, p_project, coalesce(p_note, ''), coalesce(p_effective, current_date), auth.uid())
    returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Invites for the signed-in email
-- ---------------------------------------------------------------------------

create or replace function public.my_invites()
returns table (token uuid, org_name text, role text, invited_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.token, o.name, i.role, i.created_at
  from public.invites i
  join public.orgs o on o.id = i.org_id
  join public.profiles p on p.id = auth.uid()
  where i.email = p.email and i.accepted_at is null
  order by i.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'staff_set_lead', 'request_resize', 'submit_project', 'staff_send_estimate', 'staff_ledger_entry', 'my_invites')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('active_project_count', 'effective_limit')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
