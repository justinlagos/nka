-- Nka v1 schema: client orgs, briefs and projects, review, library, Flex budget, leads.
-- Every table has row-level security. Status changes go through security-definer functions
-- that check who is asking, so the browser can never set a status or a price itself.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- Emails that become studio staff when they first sign in.
create table public.staff_emails (
  email text primary key check (email = lower(email))
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, is_staff)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    exists (select 1 from public.staff_emails s where s.email = lower(coalesce(new.email, '')))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Client organisations
-- ---------------------------------------------------------------------------

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  country text not null default '',
  plan text not null default 'none'
    check (plan in ('none', 'starter', 'growth', 'studio', 'flex', 'bespoke')),
  plan_status text not null default 'inactive'
    check (plan_status in ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'paused')),
  active_limit int check (active_limit is null or active_limit > 0),
  currency text not null default 'gbp' check (currency in ('gbp', 'usd', 'eur', 'ngn')),
  rollover_months int not null default 2 check (rollover_months between 0 and 12),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members(user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_org_idx on public.invites(org_id);

create table public.brand_books (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  about text not null default '' check (char_length(about) <= 4000),
  audiences text not null default '' check (char_length(audiences) <= 4000),
  voice text not null default '' check (char_length(voice) <= 4000),
  colours text not null default '' check (char_length(colours) <= 2000),
  typefaces text not null default '' check (char_length(typefaces) <= 2000),
  rules text not null default '' check (char_length(rules) <= 4000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Work
-- ---------------------------------------------------------------------------

create sequence public.project_number_seq start 1001;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.project_number_seq'),
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  service text not null default '',
  status text not null default 'draft' check (status in (
    'draft', 'queued', 'submitted', 'awaiting_approval', 'in_progress',
    'in_review', 'changes_requested', 'completed', 'cancelled')),
  brief jsonb not null default '{}'::jsonb check (pg_column_size(brief) < 60000),
  deadline date,
  kickoff_call boolean not null default false,
  allow_ai boolean not null default true,
  auto_approve boolean not null default false,
  estimate_amount numeric(12, 2) check (estimate_amount is null or estimate_amount >= 0),
  estimate_hours numeric(7, 1) check (estimate_hours is null or estimate_hours >= 0),
  estimate_due date,
  estimate_notes text not null default '',
  estimate_sent_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  assignee uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_org_status_idx on public.projects(org_id, status);
create index projects_status_idx on public.projects(status);

-- Files a client adds: references on a brief (project_id set) or brand assets (project_id null).
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null default 'reference' check (kind in ('reference', 'brand')),
  storage_path text not null unique,
  file_name text not null,
  mime text not null default '',
  size bigint not null default 0,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index attachments_project_idx on public.attachments(project_id);
create index attachments_org_idx on public.attachments(org_id);

-- Work the studio delivers. Each upload with the same title is a new version.
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  version int not null default 1,
  storage_path text not null unique,
  file_name text not null,
  mime text not null default '',
  size bigint not null default 0,
  note text not null default '',
  status text not null default 'in_review' check (status in ('in_review', 'changes_requested', 'approved')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index deliverables_project_idx on public.deliverables(project_id);
create index deliverables_org_status_idx on public.deliverables(org_id, status);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  deliverable_id uuid references public.deliverables(id) on delete cascade,
  author uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  pin_x real check (pin_x is null or (pin_x >= 0 and pin_x <= 1)),
  pin_y real check (pin_y is null or (pin_y >= 0 and pin_y <= 1)),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_project_idx on public.comments(project_id, created_at);

create table public.project_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  actor uuid references public.profiles(id) on delete set null,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index project_events_project_idx on public.project_events(project_id, created_at);

-- Flex budget: credits are positive, spend and expiry are negative.
create table public.budget_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  kind text not null check (kind in ('allocation', 'top_up', 'spend', 'refund', 'expiry', 'adjustment')),
  amount numeric(12, 2) not null check (amount <> 0),
  project_id uuid references public.projects(id) on delete set null,
  note text not null default '',
  effective_on date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index budget_ledger_org_idx on public.budget_ledger(org_id, effective_on);

-- Book-a-call requests from the public site.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200 and position('@' in email) > 1),
  company text not null default '' check (char_length(company) <= 160),
  company_size text not null default '' check (char_length(company_size) <= 40),
  country text not null default '' check (char_length(country) <= 80),
  interest text not null default '' check (char_length(interest) <= 40),
  budget text not null default '' check (char_length(budget) <= 40),
  message text not null default '' check (char_length(message) <= 4000),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_staff from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.org_role(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.org_members m where m.org_id = p_org and m.user_id = auth.uid()
$$;

create or replace function public.can_view_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_org is not null and (public.is_staff() or public.org_role(p_org) is not null)
$$;

create or replace function public.can_edit_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_org is not null and (public.is_staff() or coalesce(public.org_role(p_org) in ('owner', 'admin', 'member'), false))
$$;

create or replace function public.can_admin_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_org is not null and coalesce(public.org_role(p_org) in ('owner', 'admin'), false)
$$;

-- Storage paths start with the org id; a bad prefix must deny, not error.
create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.staff_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.invites enable row level security;
alter table public.brand_books enable row level security;
alter table public.projects enable row level security;
alter table public.attachments enable row level security;
alter table public.deliverables enable row level security;
alter table public.comments enable row level security;
alter table public.project_events enable row level security;
alter table public.budget_ledger enable row level security;
alter table public.leads enable row level security;

-- Column-level write access. Everything not granted here changes only through functions.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (name, country) on public.orgs to authenticated;
grant delete on public.org_members to authenticated;
grant insert (org_id, email, role, invited_by) on public.invites to authenticated;
grant delete on public.invites to authenticated;
grant update (about, audiences, voice, colours, typefaces, rules, updated_at, updated_by) on public.brand_books to authenticated;
grant insert (org_id, title, service, brief, deadline, kickoff_call, allow_ai, auto_approve, created_by) on public.projects to authenticated;
grant update (title, service, brief, deadline, kickoff_call, allow_ai, auto_approve) on public.projects to authenticated;
grant delete on public.projects to authenticated;
grant insert (org_id, project_id, kind, storage_path, file_name, mime, size, uploaded_by) on public.attachments to authenticated;
grant delete on public.attachments to authenticated;
grant insert (project_id, org_id, deliverable_id, author, body, pin_x, pin_y) on public.comments to authenticated;
grant update (resolved) on public.comments to authenticated;
grant insert (name, email, company, company_size, country, interest, budget, message) on public.leads to anon, authenticated;
grant update (status) on public.leads to authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_staff()
  or is_staff
  or exists (
    select 1 from public.org_members a
    join public.org_members b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = profiles.id)
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- orgs
create policy orgs_select on public.orgs for select to authenticated using (public.can_view_org(id));
create policy orgs_update on public.orgs for update to authenticated
  using (public.can_admin_org(id)) with check (public.can_admin_org(id));

-- org_members
create policy members_select on public.org_members for select to authenticated using (public.can_view_org(org_id));
create policy members_delete on public.org_members for delete to authenticated
  using (public.can_admin_org(org_id) and role <> 'owner');

-- invites
create policy invites_select on public.invites for select to authenticated using (public.can_admin_org(org_id));
create policy invites_insert on public.invites for insert to authenticated
  with check (public.can_admin_org(org_id) and invited_by = auth.uid());
create policy invites_delete on public.invites for delete to authenticated using (public.can_admin_org(org_id));

-- brand_books
create policy brand_select on public.brand_books for select to authenticated using (public.can_view_org(org_id));
create policy brand_update on public.brand_books for update to authenticated
  using (public.can_edit_org(org_id)) with check (public.can_edit_org(org_id));

-- projects: clients write only while a brief is still a draft
create policy projects_select on public.projects for select to authenticated using (public.can_view_org(org_id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.can_edit_org(org_id) and created_by = auth.uid() and status = 'draft');
create policy projects_update on public.projects for update to authenticated
  using (public.can_edit_org(org_id) and status = 'draft')
  with check (public.can_edit_org(org_id) and status = 'draft');
create policy projects_delete on public.projects for delete to authenticated
  using (public.can_edit_org(org_id) and status = 'draft');

-- attachments
create policy attachments_select on public.attachments for select to authenticated using (public.can_view_org(org_id));
create policy attachments_insert on public.attachments for insert to authenticated with check (
  public.can_edit_org(org_id)
  and uploaded_by = auth.uid()
  and split_part(storage_path, '/', 1) = org_id::text
  and (project_id is null or exists (
    select 1 from public.projects p where p.id = project_id and p.org_id = attachments.org_id))
);
create policy attachments_delete on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() or public.can_admin_org(org_id));

-- deliverables: read by the client, written by staff through staff_add_deliverable
create policy deliverables_select on public.deliverables for select to authenticated using (public.can_view_org(org_id));

-- comments
create policy comments_select on public.comments for select to authenticated using (public.can_view_org(org_id));
create policy comments_insert on public.comments for insert to authenticated with check (
  public.can_edit_org(org_id)
  and author = auth.uid()
  and exists (select 1 from public.projects p where p.id = project_id and p.org_id = comments.org_id)
  and (deliverable_id is null or exists (
    select 1 from public.deliverables d where d.id = deliverable_id and d.project_id = comments.project_id))
);
create policy comments_update on public.comments for update to authenticated
  using (public.can_edit_org(org_id)) with check (public.can_edit_org(org_id));

-- events and ledger: read only
create policy events_select on public.project_events for select to authenticated using (public.can_view_org(org_id));
create policy ledger_select on public.budget_ledger for select to authenticated using (public.can_view_org(org_id));

-- leads: anyone can send one, only staff can read them
create policy leads_insert on public.leads for insert to anon, authenticated with check (status = 'new');
create policy leads_select on public.leads for select to authenticated using (public.is_staff());
create policy leads_update on public.leads for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

create or replace function public.log_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (new.id, new.org_id, auth.uid(), 'status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;

create trigger projects_status_log after update on public.projects
  for each row execute function public.log_status_change();

-- ---------------------------------------------------------------------------
-- Workflow functions
-- ---------------------------------------------------------------------------

create or replace function public.active_project_count(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.projects
  where org_id = p_org
    and status in ('submitted', 'awaiting_approval', 'in_progress', 'in_review', 'changes_requested')
$$;

-- The cap that applies right now, or null for no cap.
create or replace function public.effective_limit(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when o.plan in ('starter', 'growth', 'studio') and o.plan_status in ('active', 'trialing')
              then o.active_limit else null end
  from public.orgs o where o.id = p_org
$$;

-- Move the oldest queued briefs up while there is room.
create or replace function public.promote_queue(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_limit int := public.effective_limit(p_org);
  v_next uuid;
begin
  loop
    exit when v_limit is not null and public.active_project_count(p_org) >= v_limit;
    select id into v_next from public.projects
      where org_id = p_org and status = 'queued'
      order by submitted_at nulls last, created_at
      limit 1 for update skip locked;
    exit when v_next is null;
    update public.projects set status = 'submitted' where id = v_next;
  end loop;
end $$;

create or replace function public.create_org(p_name text, p_country text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Add your company name.' using errcode = '22023'; end if;
  insert into public.orgs (name, country, created_by)
    values (trim(p_name), coalesce(trim(p_country), ''), auth.uid()) returning id into v_org;
  insert into public.org_members (org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  insert into public.brand_books (org_id, updated_by) values (v_org, auth.uid());
  return v_org;
end $$;

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
  update public.projects set status = v_status, submitted_at = now() where id = p_project;
  return v_status;
end $$;

-- Internal: mark approved and draw Flex budget.
create or replace function public._approve_project(p_project uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  v_plan text;
begin
  select * into v from public.projects where id = p_project for update;
  select plan into v_plan from public.orgs where id = v.org_id;
  update public.projects
    set status = 'in_progress', approved_at = now(), approved_by = p_actor
    where id = p_project;
  if v_plan = 'flex' and coalesce(v.estimate_amount, 0) > 0 then
    insert into public.budget_ledger (org_id, kind, amount, project_id, note, created_by)
    values (v.org_id, 'spend', -v.estimate_amount, v.id, 'Project ' || v.number || ': ' || v.title, p_actor);
  end if;
end $$;
revoke execute on function public._approve_project(uuid, uuid) from public, anon, authenticated;

create or replace function public.approve_estimate(p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
begin
  select * into v from public.projects where id = p_project;
  if not found or not public.can_view_org(v.org_id) then raise exception 'Project not found.' using errcode = '42501'; end if;
  if not public.can_admin_org(v.org_id) then
    raise exception 'Only an owner or admin can approve estimates.' using errcode = '42501';
  end if;
  if v.status <> 'awaiting_approval' then raise exception 'There is no estimate waiting on this project.' using errcode = '22023'; end if;
  perform public._approve_project(p_project, auth.uid());
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, auth.uid(), 'estimate_approved', jsonb_build_object('amount', v.estimate_amount));
end $$;

create or replace function public.decline_estimate(p_project uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
begin
  select * into v from public.projects where id = p_project;
  if not found or not public.can_admin_org(v.org_id) then
    raise exception 'Only an owner or admin can decline estimates.' using errcode = '42501';
  end if;
  if v.status <> 'awaiting_approval' then raise exception 'There is no estimate waiting on this project.' using errcode = '22023'; end if;
  update public.projects set status = 'submitted' where id = p_project;
  if coalesce(trim(p_note), '') <> '' then
    insert into public.comments (project_id, org_id, author, body)
      values (v.id, v.org_id, auth.uid(), 'Estimate declined: ' || trim(p_note));
  end if;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, auth.uid(), 'estimate_declined', jsonb_build_object('note', coalesce(p_note, '')));
end $$;

create or replace function public.decide_deliverable(p_deliverable uuid, p_decision text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.deliverables%rowtype;
begin
  select * into d from public.deliverables where id = p_deliverable for update;
  if not found or not public.can_edit_org(d.org_id) then raise exception 'File not found.' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'changes_requested') then raise exception 'Unknown decision.' using errcode = '22023'; end if;
  if d.status <> 'in_review' then raise exception 'This version has already been reviewed.' using errcode = '22023'; end if;
  if p_decision = 'changes_requested' and coalesce(trim(p_note), '') = '' then
    raise exception 'Say what needs to change.' using errcode = '22023';
  end if;
  update public.deliverables set status = p_decision, decided_by = auth.uid(), decided_at = now() where id = p_deliverable;
  if coalesce(trim(p_note), '') <> '' then
    insert into public.comments (project_id, org_id, deliverable_id, author, body)
      values (d.project_id, d.org_id, d.id, auth.uid(), trim(p_note));
  end if;
  if p_decision = 'changes_requested' then
    update public.projects set status = 'changes_requested' where id = d.project_id and status in ('in_review', 'in_progress');
  end if;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (d.project_id, d.org_id, auth.uid(), 'deliverable_' || p_decision,
            jsonb_build_object('title', d.title, 'version', d.version));
end $$;

create or replace function public.complete_project(p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
begin
  select * into v from public.projects where id = p_project for update;
  if not found or not public.can_edit_org(v.org_id) then raise exception 'Project not found.' using errcode = '42501'; end if;
  if v.status not in ('in_review', 'in_progress', 'changes_requested') then
    raise exception 'This project can''t be completed from its current stage.' using errcode = '22023';
  end if;
  if exists (select 1 from public.deliverables where project_id = p_project and status = 'in_review') then
    raise exception 'Review every file before completing the project.' using errcode = '22023';
  end if;
  update public.projects set status = 'completed', completed_at = now() where id = p_project;
  perform public.promote_queue(v.org_id);
end $$;

create or replace function public.cancel_project(p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
begin
  select * into v from public.projects where id = p_project for update;
  if not found or not (public.can_admin_org(v.org_id) or v.created_by = auth.uid() or public.is_staff()) then
    raise exception 'Only the person who sent it, an admin or the studio can cancel this.' using errcode = '42501';
  end if;
  if v.status not in ('queued', 'submitted', 'awaiting_approval') and not public.is_staff() then
    raise exception 'Work has started. Ask the studio in the comments to stop it.' using errcode = '22023';
  end if;
  if v.status in ('completed', 'cancelled') then raise exception 'This project is already closed.' using errcode = '22023'; end if;
  update public.projects set status = 'cancelled' where id = p_project;
  perform public.promote_queue(v.org_id);
end $$;

create or replace function public.accept_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  i public.invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select email into v_email from public.profiles where id = auth.uid();
  select * into i from public.invites where token = p_token for update;
  if not found then raise exception 'This invite link is not valid.' using errcode = '22023'; end if;
  if i.accepted_at is not null then raise exception 'This invite has already been used.' using errcode = '22023'; end if;
  if i.email <> v_email then
    raise exception 'This invite was sent to %. Sign in with that email to accept it.', i.email using errcode = '42501';
  end if;
  insert into public.org_members (org_id, user_id, role) values (i.org_id, auth.uid(), i.role)
    on conflict (org_id, user_id) do nothing;
  update public.invites set accepted_at = now() where id = i.id;
  return i.org_id;
end $$;

create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_admin_org(p_org) then raise exception 'Only an owner or admin can change roles.' using errcode = '42501'; end if;
  if p_role not in ('admin', 'member', 'viewer') then raise exception 'Unknown role.' using errcode = '22023'; end if;
  update public.org_members set role = p_role where org_id = p_org and user_id = p_user and role <> 'owner';
end $$;

-- ---------------------------------------------------------------------------
-- Studio (staff) functions
-- ---------------------------------------------------------------------------

create or replace function public.require_staff()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Studio staff only.' using errcode = '42501'; end if;
end $$;

create or replace function public.staff_send_estimate(
  p_project uuid, p_amount numeric, p_hours numeric, p_due date, p_notes text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  v_plan text;
begin
  perform public.require_staff();
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found.' using errcode = '22023'; end if;
  if v.status not in ('submitted', 'awaiting_approval') then
    raise exception 'Estimates go on submitted projects.' using errcode = '22023';
  end if;
  select plan into v_plan from public.orgs where id = v.org_id;
  update public.projects set
    estimate_amount = p_amount, estimate_hours = p_hours, estimate_due = p_due,
    estimate_notes = coalesce(p_notes, ''), estimate_sent_at = now(), status = 'awaiting_approval'
  where id = p_project;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, auth.uid(), 'estimate_sent',
            jsonb_build_object('amount', p_amount, 'hours', p_hours, 'due', p_due));
  -- Plan clients pay a fixed fee, so the plan goes straight into production. So does
  -- anyone who ticked "start without waiting for my approval".
  if v.auto_approve or v_plan in ('starter', 'growth', 'studio') then
    perform public._approve_project(p_project, auth.uid());
    return 'in_progress';
  end if;
  return 'awaiting_approval';
end $$;

create or replace function public.staff_set_status(p_project uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
begin
  perform public.require_staff();
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found.' using errcode = '22023'; end if;
  if p_status not in ('submitted', 'in_progress', 'in_review', 'changes_requested', 'completed', 'cancelled', 'queued') then
    raise exception 'Unknown status.' using errcode = '22023';
  end if;
  update public.projects set
    status = p_status,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_project;
  if p_status in ('completed', 'cancelled') then perform public.promote_queue(v.org_id); end if;
end $$;

create or replace function public.staff_assign(p_project uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if p_user is not null and not exists (select 1 from public.profiles where id = p_user and is_staff) then
    raise exception 'Assign studio staff only.' using errcode = '22023';
  end if;
  update public.projects set assignee = p_user where id = p_project;
end $$;

create or replace function public.staff_add_deliverable(
  p_project uuid, p_title text, p_path text, p_file_name text, p_mime text, p_size bigint, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  v_id uuid;
  v_version int;
begin
  perform public.require_staff();
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found.' using errcode = '22023'; end if;
  if split_part(p_path, '/', 1) <> v.org_id::text then raise exception 'File is in the wrong folder.' using errcode = '22023'; end if;
  if v.status in ('draft', 'queued', 'cancelled') then
    raise exception 'Start the project before adding files.' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v_version
    from public.deliverables where project_id = p_project and lower(title) = lower(trim(p_title));
  insert into public.deliverables (project_id, org_id, title, version, storage_path, file_name, mime, size, note, uploaded_by)
    values (p_project, v.org_id, trim(p_title), v_version, p_path, p_file_name, coalesce(p_mime, ''), coalesce(p_size, 0),
            coalesce(p_note, ''), auth.uid())
    returning id into v_id;
  update public.projects set status = 'in_review' where id = p_project and status <> 'completed';
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, auth.uid(), 'deliverable_added', jsonb_build_object('title', trim(p_title), 'version', v_version));
  return v_id;
end $$;

create or replace function public.staff_set_plan(
  p_org uuid, p_plan text, p_status text, p_limit int, p_currency text, p_rollover int)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  update public.orgs set
    plan = p_plan, plan_status = p_status, active_limit = p_limit,
    currency = coalesce(p_currency, currency), rollover_months = coalesce(p_rollover, rollover_months)
  where id = p_org;
  if not found then raise exception 'Client not found.' using errcode = '22023'; end if;
  perform public.promote_queue(p_org);
end $$;

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
  if p_kind in ('spend', 'expiry') and p_amount >= 0 then
    raise exception 'Spend and expiry must be negative.' using errcode = '22023';
  end if;
  insert into public.budget_ledger (org_id, kind, amount, project_id, note, effective_on, created_by)
    values (p_org, p_kind, p_amount, p_project, coalesce(p_note, ''), coalesce(p_effective, current_date), auth.uid())
    returning id into v_id;
  return v_id;
end $$;

-- Lock the functions down: signed-in users only, never anonymous.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'create_org', 'submit_project', 'approve_estimate', 'decline_estimate', 'decide_deliverable',
      'complete_project', 'cancel_project', 'accept_invite', 'set_member_role', 'staff_send_estimate',
      'staff_set_status', 'staff_assign', 'staff_add_deliverable', 'staff_set_plan', 'staff_ledger_entry',
      'require_staff')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
  -- Internal helpers: called only from the functions above.
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('promote_queue', 'active_project_count', 'effective_limit')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant usage on sequence public.project_number_seq to authenticated;
grant execute on function public.is_staff(), public.org_role(uuid), public.can_view_org(uuid),
  public.can_edit_org(uuid), public.can_admin_org(uuid), public.try_uuid(text) to authenticated;

-- ---------------------------------------------------------------------------
-- File storage: one private bucket, folders named by org id
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 524288000)
on conflict (id) do nothing;

create policy files_select on storage.objects for select to authenticated
  using (bucket_id = 'files' and public.can_view_org(public.try_uuid((storage.foldername(name))[1])));
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.can_edit_org(public.try_uuid((storage.foldername(name))[1])));
create policy files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'files' and owner_id = auth.uid()::text);
