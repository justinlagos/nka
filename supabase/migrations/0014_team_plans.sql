-- 0014: the v3 team plans (decided 11 Nov 2026).
--   * Plans: Instant, Starter, Growth, Studio and Bespoke. Flex is gone.
--   * Every plan has a monthly pool of team hours. A brief uses the hours Nka estimates when it starts;
--     unused hours carry into the next month only; 5-hour top-ups; a late first draft gives its hours back;
--     a brief cancelled before the client sees anything gives its hours back.
--   * Nka review: a version from a partner's designer or copywriter is checked before the client sees it,
--     by the Nka admin or the client's creative lead, never by someone from the same agency.
--   * Talent roles (designer, copywriter, creative lead, marketing lead, motion) and a team per client.
--   * Every new person is on trial until they pass Nka's test task. Until then they only work on
--     workspaces the admin marks as internal.

-- ---------- Plans ----------

alter table public.orgs drop constraint if exists orgs_plan_check;
update public.orgs set plan = 'none', plan_status = 'inactive', active_limit = null where plan = 'flex';
alter table public.orgs add constraint orgs_plan_check
  check (plan in ('none', 'instant', 'starter', 'growth', 'studio', 'bespoke'));
alter table public.orgs add column if not exists internal boolean not null default false;

-- A paid-up team plan.
create or replace function public.on_plan(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select o.plan in ('instant', 'starter', 'growth', 'studio') and o.plan_status in ('active', 'trialing')
                   from public.orgs o where o.id = p_org), false)
$$;

-- Team hours a month, by plan. Change the numbers here and in src/lib/plans.ts.
create or replace function public.plan_hours(p_plan text)
returns numeric language sql immutable as $$
  select (case p_plan when 'instant' then 1 when 'starter' then 8 when 'growth' then 20 when 'studio' then 40 else 0 end)::numeric
$$;

create or replace function public.effective_limit(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select case
    when o.plan_status = 'paused' then 0
    when o.plan in ('instant', 'starter', 'growth', 'studio') and o.plan_status in ('active', 'trialing') then o.active_limit
    else null end
  from public.orgs o where o.id = p_org
$$;

-- Instant briefs a month, by plan.
create or replace function public.instant_limit(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select case
    when o.plan = 'studio' and o.plan_status in ('active', 'trialing') then 50
    when o.plan = 'growth' and o.plan_status in ('active', 'trialing') then 30
    when o.plan = 'starter' and o.plan_status in ('active', 'trialing') then 20
    when o.plan = 'instant' and o.plan_status in ('active', 'trialing') then 10
    when o.plan = 'bespoke' then 30
    else 2 end
  from public.orgs o where o.id = p_org
$$;

-- ---------- Team hours ----------

create table if not exists public.hours_ledger (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs (id) on delete cascade,
  month date not null,
  kind text not null check (kind in ('allowance', 'use', 'return', 'top_up', 'adjustment')),
  hours numeric(7, 2) not null,
  project_id uuid references public.projects (id) on delete set null,
  note text not null default '' check (char_length(note) <= 500),
  stripe_ref text unique,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists hours_allowance_once on public.hours_ledger (org_id, month) where kind = 'allowance';
create unique index if not exists hours_use_once on public.hours_ledger (project_id) where kind = 'use';
create unique index if not exists hours_return_once on public.hours_ledger (project_id) where kind = 'return';
create index if not exists hours_ledger_org_month on public.hours_ledger (org_id, month);
alter table public.hours_ledger enable row level security;
drop policy if exists hours_select on public.hours_ledger;
create policy hours_select on public.hours_ledger for select using (public.can_view_org(org_id));

create or replace function public.hours_month()
returns date language sql stable as $$
  select date_trunc('month', now() at time zone 'Europe/London')::date
$$;

-- This month's allowance, written the first time it's needed. An upgrade tops it up to the new plan.
create or replace function public.ensure_allowance(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orgs%rowtype;
begin
  select * into o from public.orgs where id = p_org;
  if not found or not public.on_plan(p_org) then return; end if;
  insert into public.hours_ledger (org_id, month, kind, hours, note)
    values (p_org, public.hours_month(), 'allowance', public.plan_hours(o.plan), initcap(o.plan) || ' plan')
  on conflict (org_id, month) where kind = 'allowance'
    do update set hours = greatest(public.hours_ledger.hours, excluded.hours), note = excluded.note;
end $$;

-- Hours left. Hours granted in a month (allowance, top-ups, returns) last that month and the next;
-- use comes out of last month's leftover first.
create or replace function public.hours_balance(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m0 date := public.hours_month();
  m1 date := (public.hours_month() - interval '1 month')::date;
  m2 date := (public.hours_month() - interval '2 months')::date;
  g2 numeric; u2 numeric; g1 numeric; u1 numeric; g0 numeric; u0 numeric;
  c1 numeric; c0 numeric; a0 numeric; t0 numeric;
begin
  -- Signed-in people see their own clients only; the server (no signed-in user) sees any.
  if auth.uid() is not null and not public.can_view_org(p_org) then
    raise exception 'Not found.' using errcode = '42501';
  end if;
  perform public.ensure_allowance(p_org);
  select coalesce(sum(hours) filter (where month = m2 and hours > 0), 0), coalesce(-sum(hours) filter (where month = m2 and hours < 0), 0),
         coalesce(sum(hours) filter (where month = m1 and hours > 0), 0), coalesce(-sum(hours) filter (where month = m1 and hours < 0), 0),
         coalesce(sum(hours) filter (where month = m0 and hours > 0), 0), coalesce(-sum(hours) filter (where month = m0 and hours < 0), 0),
         coalesce(sum(hours) filter (where month = m0 and kind = 'allowance'), 0),
         coalesce(sum(hours) filter (where month = m0 and kind = 'top_up'), 0)
    into g2, u2, g1, u1, g0, u0, a0, t0
    from public.hours_ledger where org_id = p_org and month >= m2;
  c1 := greatest(0, g2 - u2);
  c0 := greatest(0, g1 - greatest(0, u1 - c1));
  return jsonb_build_object(
    'month', m0, 'allowance', a0, 'top_ups', t0, 'carried', c0,
    'granted', g0, 'used', u0, 'left', greatest(0, c0 + g0 - u0));
end $$;

create or replace function public.hours_left(p_org uuid)
returns numeric language sql security definer set search_path = public as $$
  select (public.hours_balance(p_org)->>'left')::numeric
$$;

-- A paid 5-hour top-up, written by the Stripe webhook. Server only.
create or replace function public.system_top_up(p_org uuid, p_hours numeric, p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.hours_ledger (org_id, month, kind, hours, note, stripe_ref)
    values (p_org, public.hours_month(), 'top_up', p_hours, p_hours || ' extra hours', p_ref)
  on conflict (stripe_ref) do nothing;
  return found;
end $$;

-- The admin adds or removes hours by hand.
create or replace function public.staff_adjust_hours(p_org uuid, p_hours numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if coalesce(p_hours, 0) = 0 then raise exception 'Enter the hours to add or remove.' using errcode = '22023'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Say why.' using errcode = '22023'; end if;
  insert into public.hours_ledger (org_id, month, kind, hours, note, created_by)
    values (p_org, public.hours_month(), 'adjustment', p_hours, left(trim(p_note), 500), auth.uid());
end $$;

-- Starts a brief on plan hours. Used by the server when a brief is sent, and again when hours arrive
-- for a brief that was waiting. Returns started, needs_hours, not_on_plan or not_ready. Server only.
create or replace function public.system_start_brief(p_project uuid, p_hours numeric, p_due date, p_notes text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  o public.orgs%rowtype;
  v_left numeric;
begin
  select * into v from public.projects where id = p_project for update;
  if not found or v.status <> 'submitted' or v.kind <> 'brief' then return 'not_ready'; end if;
  select * into o from public.orgs where id = v.org_id;
  if not public.on_plan(o.id) then return 'not_on_plan'; end if;
  v_left := public.hours_left(o.id);
  if v_left < p_hours then
    update public.projects set estimate_hours = p_hours, estimate_notes = coalesce(p_notes, '') where id = p_project;
    if not exists (select 1 from public.project_events where project_id = v.id and kind = 'waiting_for_hours') then
      insert into public.project_events (project_id, org_id, actor, kind, detail)
        values (v.id, v.org_id, null, 'waiting_for_hours', jsonb_build_object('hours', p_hours, 'left', v_left));
    end if;
    return 'needs_hours';
  end if;
  update public.projects set
    estimate_amount = 0, estimate_hours = p_hours, estimate_due = p_due,
    estimate_notes = coalesce(p_notes, ''), estimate_sent_at = now(),
    status = 'in_progress', approved_at = now(),
    assignee = coalesce(assignee, o.lead_id)
  where id = p_project;
  insert into public.hours_ledger (org_id, month, kind, hours, project_id, note)
    values (v.org_id, public.hours_month(), 'use', -p_hours, v.id, left('NKA-' || v.number || ' ' || v.title, 500))
  on conflict do nothing;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, null, 'auto_started', jsonb_build_object('due', p_due, 'hours', p_hours));
  return 'started';
end $$;

-- Briefs waiting for hours, oldest first. Server only.
create or replace function public.system_waiting_briefs(p_org uuid default null)
returns table (id uuid, org_id uuid, hours numeric) language sql stable security definer set search_path = public as $$
  select p.id, p.org_id, p.estimate_hours from public.projects p
  where p.status = 'submitted' and p.kind = 'brief' and p.estimate_hours is not null
    and (p_org is null or p.org_id = p_org) and public.on_plan(p.org_id)
    and exists (select 1 from public.project_events e where e.project_id = p.id and e.kind = 'waiting_for_hours')
  order by p.submitted_at nulls last, p.created_at
$$;

-- Plan clients: a designer confirming a date also takes the hours.
create or replace function public.staff_send_estimate(p_project uuid, p_amount numeric, p_hours numeric, p_due date, p_notes text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  o public.orgs%rowtype;
  v_admin boolean := public.is_staff();
  v_plan boolean;
  v_left numeric;
begin
  perform public.require_studio_project(p_project);
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found.' using errcode = '22023'; end if;
  if v.status not in ('submitted', 'awaiting_approval') then
    raise exception 'Estimates go on submitted projects. Once approved, the price is fixed.' using errcode = '22023';
  end if;
  select * into o from public.orgs where id = v.org_id;
  v_plan := public.on_plan(o.id);

  if v_plan and v.kind = 'brief' then
    v_left := public.hours_left(o.id);
    if coalesce(p_hours, 0) <= 0 then raise exception 'Enter the hours.' using errcode = '22023'; end if;
    if v_left < p_hours and not v_admin then
      raise exception 'This client has % team hours left this month. The brief starts when they add hours or on the 1st.', v_left
        using errcode = '22023';
    end if;
  end if;

  if not v_admin and not v_plan then
    update public.projects set
      estimate_hours = p_hours, estimate_due = p_due, estimate_notes = coalesce(p_notes, ''),
      assignee = coalesce(assignee, auth.uid())
    where id = p_project;
    insert into public.project_events (project_id, org_id, actor, kind, detail)
      values (v.id, v.org_id, auth.uid(), 'estimate_proposed', jsonb_build_object('hours', p_hours, 'due', p_due));
    return 'proposed';
  end if;

  update public.projects set
    estimate_amount = case when v_plan then 0 when v_admin then p_amount else null end,
    estimate_hours = p_hours, estimate_due = p_due,
    estimate_notes = coalesce(p_notes, ''), estimate_sent_at = now(), status = 'awaiting_approval',
    assignee = coalesce(assignee, case when v_admin then null else auth.uid() end)
  where id = p_project;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, auth.uid(), 'estimate_sent',
            jsonb_build_object('amount', case when v_admin and not v_plan then p_amount else 0 end, 'hours', p_hours, 'due', p_due));
  if v.auto_approve or v_plan then
    if v_plan and v.kind = 'brief' then
      insert into public.hours_ledger (org_id, month, kind, hours, project_id, note, created_by)
        values (v.org_id, public.hours_month(), 'use', -p_hours, v.id, left('NKA-' || v.number || ' ' || v.title, 500), auth.uid())
      on conflict do nothing;
    end if;
    perform public._approve_project(p_project, auth.uid());
    return 'in_progress';
  end if;
  return 'awaiting_approval';
end $$;

-- A brief cancelled before the client has seen any version gives its hours back.
create or replace function public.return_hours_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_used numeric;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    select -hours into v_used from public.hours_ledger where project_id = new.id and kind = 'use';
    if v_used is not null and not exists (
      select 1 from public.deliverables d where d.project_id = new.id and d.status in ('in_review', 'approved', 'changes_requested')) then
      insert into public.hours_ledger (org_id, month, kind, hours, project_id, note)
        values (new.org_id, public.hours_month(), 'return', v_used, new.id, 'Cancelled before a first draft')
      on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists projects_return_hours on public.projects;
create trigger projects_return_hours after update of status on public.projects
  for each row execute function public.return_hours_on_cancel();

-- ---------- Talent roles, client teams and the test task ----------

alter table public.profiles add column if not exists talent_role text not null default 'designer';
alter table public.profiles drop constraint if exists profiles_talent_role_check;
alter table public.profiles add constraint profiles_talent_role_check
  check (talent_role in ('designer', 'copywriter', 'creative_lead', 'marketing_lead', 'motion'));
alter table public.profiles add column if not exists vetting text not null default 'trial';
alter table public.profiles drop constraint if exists profiles_vetting_check;
alter table public.profiles add constraint profiles_vetting_check check (vetting in ('trial', 'passed', 'failed'));
alter table public.profiles add column if not exists vetted_at timestamptz;
alter table public.profiles add column if not exists vetting_note text not null default '';
-- People already working before the test task existed.
update public.profiles set vetting = 'passed', vetted_at = now(), vetting_note = 'Working before the test task began'
  where is_talent and vetting = 'trial';

-- A client's team beyond the lead (orgs.lead_id stays the lead designer or copywriter).
create table if not exists public.org_team (
  org_id uuid not null references public.orgs (id) on delete cascade,
  role text not null check (role in ('copywriter', 'creative_lead', 'marketing_lead', 'motion', 'designer')),
  user_id uuid not null references public.profiles (id) on delete cascade,
  since timestamptz not null default now(),
  primary key (org_id, role)
);
alter table public.org_team enable row level security;
drop policy if exists org_team_select on public.org_team;
create policy org_team_select on public.org_team for select using (public.can_view_org(org_id));

create or replace function public.ready_for(p_user uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_staff or (p.is_talent and p.talent_active and
           (p.vetting = 'passed' or exists (select 1 from public.orgs o where o.id = p_org and o.internal)))
         from public.profiles p where p.id = p_user), false)
$$;

create or replace function public.talent_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_org is not null and public.is_talent() and (
    exists (select 1 from public.orgs o where o.id = p_org and o.lead_id = auth.uid())
    or exists (select 1 from public.org_team t where t.org_id = p_org and t.user_id = auth.uid())
    or exists (select 1 from public.projects p where p.org_id = p_org and p.assignee = auth.uid() and p.status <> 'cancelled')
  )
$$;

create or replace function public.require_studio_project(p_project uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_staff() then return; end if;
  if public.is_talent() and exists (
    select 1 from public.projects p join public.orgs o on o.id = p.org_id
    where p.id = p_project and (p.assignee = auth.uid() or o.lead_id = auth.uid()
      or exists (select 1 from public.org_team t where t.org_id = o.id and t.user_id = auth.uid()))) then
    return;
  end if;
  raise exception 'Only this client''s team or the Nka admin can do that.' using errcode = '42501';
end $$;

-- New clients only get people who have passed the test task.
create or replace function public.pick_designer()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  where p.is_talent and p.talent_active and not p.is_staff and p.vetting = 'passed' and p.talent_role = 'designer'
  order by
    (select count(*) from public.projects pr where pr.assignee = p.id
       and pr.status in ('submitted', 'awaiting_approval', 'in_progress', 'in_review', 'changes_requested')),
    (select count(*) from public.orgs o where o.lead_id = p.id),
    p.created_at
  limit 1
$$;

create or replace function public.staff_set_lead(p_org uuid, p_user uuid, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old uuid;
begin
  perform public.require_staff();
  select lead_id into v_old from public.orgs where id = p_org for update;
  if not found then raise exception 'Client not found.' using errcode = '22023'; end if;
  if p_user is not null and not public.is_designer(p_user) then
    raise exception 'Choose a designer or the admin.' using errcode = '22023';
  end if;
  if p_user is not null and not public.ready_for(p_user, p_org) then
    raise exception 'They haven''t passed the Nka test task yet. Give them the test on an internal workspace first.' using errcode = '22023';
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
  update public.projects set assignee = p_user
    where org_id = p_org and status not in ('draft', 'completed', 'cancelled')
      and (assignee is null or assignee is not distinct from v_old);
end $$;

create or replace function public.staff_assign(p_project uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  perform public.require_staff();
  select org_id into v_org from public.projects where id = p_project;
  if p_user is not null and not public.is_designer(p_user) then
    raise exception 'Assign a designer or the admin.' using errcode = '22023';
  end if;
  if p_user is not null and not public.ready_for(p_user, v_org) then
    raise exception 'They haven''t passed the Nka test task yet. Give them the test on an internal workspace first.' using errcode = '22023';
  end if;
  update public.projects set assignee = p_user where id = p_project;
end $$;

create or replace function public.admin_set_team(p_org uuid, p_role text, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if p_role not in ('copywriter', 'creative_lead', 'marketing_lead', 'motion', 'designer') then
    raise exception 'Unknown role.' using errcode = '22023';
  end if;
  if p_user is null then
    delete from public.org_team where org_id = p_org and role = p_role;
    return;
  end if;
  if not exists (select 1 from public.profiles where id = p_user and is_talent and talent_role = p_role) then
    raise exception 'Choose someone whose role is %.', replace(p_role, '_', ' ') using errcode = '22023';
  end if;
  if not public.ready_for(p_user, p_org) then
    raise exception 'They haven''t passed the Nka test task yet. Give them the test on an internal workspace first.' using errcode = '22023';
  end if;
  insert into public.org_team (org_id, role, user_id) values (p_org, p_role, p_user)
    on conflict (org_id, role) do update set user_id = excluded.user_id, since = now();
end $$;

create or replace function public.admin_set_talent(p_user uuid, p_role text, p_vetting text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old text;
begin
  perform public.require_staff();
  select vetting into v_old from public.profiles where id = p_user and is_talent;
  if not found then raise exception 'Person not found.' using errcode = '22023'; end if;
  update public.profiles set
    talent_role = coalesce(p_role, talent_role),
    vetting = coalesce(p_vetting, vetting),
    vetted_at = case when p_vetting is not null and p_vetting is distinct from v_old then now() else vetted_at end,
    vetting_note = case when p_note is not null then left(trim(p_note), 1000) else vetting_note end
  where id = p_user;
end $$;

create or replace function public.admin_set_internal(p_org uuid, p_internal boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  update public.orgs set internal = coalesce(p_internal, false) where id = p_org;
end $$;

-- ---------- Nka review before the client sees a version ----------

alter table public.deliverables drop constraint if exists deliverables_status_check;
alter table public.deliverables add constraint deliverables_status_check
  check (status in ('internal_review', 'returned', 'in_review', 'changes_requested', 'approved'));
alter table public.deliverables add column if not exists review_note text not null default '';
alter table public.deliverables add column if not exists reviewed_by uuid;
alter table public.deliverables add column if not exists reviewed_at timestamptz;
alter table public.deliverables add column if not exists review_minutes int check (review_minutes is null or review_minutes between 0 and 600);
alter table public.deliverables add column if not exists released_at timestamptz;
update public.deliverables set released_at = created_at where released_at is null and status in ('in_review', 'changes_requested', 'approved');

-- Clients never see a version still in Nka review, or one sent back, or internal events.
drop policy if exists deliverables_select on public.deliverables;
create policy deliverables_select on public.deliverables for select using (
  public.can_view_org(org_id) and (status not in ('internal_review', 'returned') or public.is_staff() or public.talent_org(org_id)));
drop policy if exists events_select on public.project_events;
create policy events_select on public.project_events for select using (
  public.can_view_org(org_id) and (kind not like 'internal\_%' or public.is_staff() or public.talent_org(org_id)));

-- Who may pass a version: the admin, or the client's creative lead, never the person who made it and
-- never someone from the same agency.
create or replace function public.can_review(p_deliverable uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.is_staff() or (
      public.is_talent() and d.uploaded_by is distinct from auth.uid()
      and exists (select 1 from public.org_team t where t.org_id = d.org_id and t.role = 'creative_lead' and t.user_id = auth.uid())
      and not exists (select 1 from public.profiles me, public.profiles maker
                      where me.id = auth.uid() and maker.id = d.uploaded_by
                        and me.partner_id is not null and me.partner_id = maker.partner_id))
    from public.deliverables d where d.id = p_deliverable), false)
$$;

-- Puts a version in front of the client. A late first draft gives the brief's hours back.
create or replace function public._release_deliverable(p_deliverable uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.deliverables%rowtype;
  v public.projects%rowtype;
  v_first boolean;
  v_used numeric;
begin
  select * into d from public.deliverables where id = p_deliverable for update;
  select * into v from public.projects where id = d.project_id for update;
  v_first := not exists (select 1 from public.deliverables x where x.project_id = d.project_id and x.id <> d.id and x.released_at is not null);
  update public.deliverables set status = 'in_review', released_at = now() where id = p_deliverable;
  update public.projects set status = 'in_review' where id = d.project_id and status <> 'completed';
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (d.project_id, d.org_id, p_actor, 'deliverable_added', jsonb_build_object('title', d.title, 'version', d.version));
  if v_first and v.estimate_due is not null and (now() at time zone 'Europe/London')::date > v.estimate_due then
    select -hours into v_used from public.hours_ledger where project_id = v.id and kind = 'use';
    if v_used is not null then
      insert into public.hours_ledger (org_id, month, kind, hours, project_id, note)
        values (v.org_id, public.hours_month(), 'return', v_used, v.id, 'First draft late: hours back')
      on conflict do nothing;
      if found then
        insert into public.project_events (project_id, org_id, actor, kind, detail)
          values (v.id, v.org_id, null, 'hours_returned_late', jsonb_build_object('hours', v_used));
      end if;
    end if;
  end if;
end $$;

create or replace function public.staff_add_deliverable(
  p_project uuid, p_title text, p_path text, p_file_name text, p_mime text, p_size bigint, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  v_id uuid;
  v_version int;
begin
  perform public.require_studio_project(p_project);
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found.' using errcode = '22023'; end if;
  if split_part(p_path, '/', 1) <> v.org_id::text then raise exception 'File is in the wrong folder.' using errcode = '22023'; end if;
  if v.status in ('draft', 'queued', 'cancelled') then
    raise exception 'Start the project before adding files.' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v_version
    from public.deliverables where project_id = p_project and lower(title) = lower(trim(p_title)) and status <> 'returned';
  insert into public.deliverables (project_id, org_id, title, version, storage_path, file_name, mime, size, note, uploaded_by, status)
    values (p_project, v.org_id, trim(p_title), v_version, p_path, p_file_name, coalesce(p_mime, ''), coalesce(p_size, 0),
            coalesce(p_note, ''), auth.uid(), 'internal_review')
    returning id into v_id;
  if public.is_staff() then
    -- The Nka admin is the reviewer: their own upload goes straight to the client.
    update public.deliverables set reviewed_by = auth.uid(), reviewed_at = now() where id = v_id;
    perform public._release_deliverable(v_id, auth.uid());
  else
    insert into public.project_events (project_id, org_id, actor, kind, detail)
      values (v.id, v.org_id, auth.uid(), 'internal_version_for_review', jsonb_build_object('title', trim(p_title), 'version', v_version));
  end if;
  return v_id;
end $$;

-- Pass a version to the client, or send it back to the maker with a note.
create or replace function public.review_deliverable(p_deliverable uuid, p_decision text, p_note text, p_minutes int)
returns text language plpgsql security definer set search_path = public as $$
declare
  d public.deliverables%rowtype;
begin
  select * into d from public.deliverables where id = p_deliverable for update;
  if not found then raise exception 'File not found.' using errcode = '22023'; end if;
  if not public.can_review(p_deliverable) then
    raise exception 'Only the Nka admin or this client''s creative lead from another agency can review this.' using errcode = '42501';
  end if;
  if d.status <> 'internal_review' then raise exception 'This version has already been reviewed.' using errcode = '22023'; end if;
  if p_decision not in ('release', 'return') then raise exception 'Unknown decision.' using errcode = '22023'; end if;
  if p_decision = 'return' and coalesce(trim(p_note), '') = '' then
    raise exception 'Say what needs fixing before the client sees it.' using errcode = '22023';
  end if;
  update public.deliverables set
    review_note = left(coalesce(trim(p_note), ''), 2000), reviewed_by = auth.uid(), reviewed_at = now(),
    review_minutes = case when p_minutes is null then null else greatest(0, least(600, p_minutes)) end,
    status = case when p_decision = 'return' then 'returned' else status end
  where id = p_deliverable;
  if p_decision = 'return' then
    insert into public.project_events (project_id, org_id, actor, kind, detail)
      values (d.project_id, d.org_id, auth.uid(), 'internal_version_returned', jsonb_build_object('title', d.title, 'version', d.version));
    return 'returned';
  end if;
  perform public._release_deliverable(p_deliverable, auth.uid());
  return 'released';
end $$;

-- ---------- Access ----------

revoke execute on function public.on_plan(uuid), public.plan_hours(text), public.ensure_allowance(uuid),
  public.system_top_up(uuid, numeric, text), public.system_start_brief(uuid, numeric, date, text),
  public.system_waiting_briefs(uuid), public.return_hours_on_cancel(), public._release_deliverable(uuid, uuid),
  public.ready_for(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.system_top_up(uuid, numeric, text), public.system_start_brief(uuid, numeric, date, text),
  public.system_waiting_briefs(uuid), public.hours_balance(uuid) to service_role;
revoke execute on function public.hours_balance(uuid), public.hours_left(uuid), public.staff_adjust_hours(uuid, numeric, text),
  public.admin_set_team(uuid, text, uuid), public.admin_set_talent(uuid, text, text, text), public.admin_set_internal(uuid, boolean),
  public.review_deliverable(uuid, text, text, int), public.can_review(uuid)
  from public, anon;
grant execute on function public.hours_balance(uuid), public.hours_left(uuid), public.staff_adjust_hours(uuid, numeric, text),
  public.admin_set_team(uuid, text, uuid), public.admin_set_talent(uuid, text, text, text), public.admin_set_internal(uuid, boolean),
  public.review_deliverable(uuid, text, text, int), public.can_review(uuid)
  to authenticated;

-- The old autostart is replaced by system_start_brief.
drop function if exists public.system_autostart(uuid, numeric, date, text);
