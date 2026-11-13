-- 0015: Abigail, the support assistant in the client workspace (Custard AI).
--   * Read only. Nothing here changes a plan, a project, team hours or a budget.
--   * Everything here runs on the server with the secret key, which skips row-level security,
--     so every function checks membership itself and none of them can be called from a browser.
--   * A lookup returns what that person already sees in their workspace: plan, team hours, Instant
--     briefs, their lead designer's alias, projects with agreed dates and files to review, and how
--     many approved files are in the library. Never payments, card details, other clients, designers'
--     real names or contact details, or versions still in Nka's internal review.
--   * A conversation belongs to one person in one organisation. A conversation id sent by a browser
--     is only carried on if it belongs to that person and organisation.
--   * A daily cap per person stops a runaway chat (or a bug) from spending the Custard credit.

-- ---------- Tables ----------

create table public.support_conversations (
  conversation_id text primary key check (char_length(conversation_id) between 1 and 200),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index support_conversations_user_idx on public.support_conversations (user_id, org_id, last_message_at desc);

-- Messages sent per person per UK day.
create table public.support_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  messages int not null default 0 check (messages >= 0),
  primary key (user_id, day)
);

-- What Custard sends back: a summary after each conversation, and support cases opening and closing.
-- Transcripts are not kept here; Custard holds them.
create table public.support_events (
  id bigint generated always as identity primary key,
  event_key text not null unique check (char_length(event_key) <= 300),
  kind text not null check (kind in ('conversation', 'case_opened', 'case_resolved', 'other')),
  conversation_id text check (char_length(conversation_id) <= 200),
  org_id uuid references public.orgs (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  summary text not null default '' check (char_length(summary) <= 4000),
  intent text not null default '' check (char_length(intent) <= 200),
  needs_human boolean not null default false,
  case_number int,
  case_subject text not null default '' check (char_length(case_subject) <= 500),
  case_status text not null default '' check (char_length(case_status) <= 40),
  case_priority text not null default '' check (char_length(case_priority) <= 40),
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) < 20000),
  created_at timestamptz not null default now()
);
create index support_events_created_idx on public.support_events (created_at desc);
create index support_events_case_idx on public.support_events (case_number) where case_number is not null;

alter table public.support_conversations enable row level security;
alter table public.support_usage enable row level security;
alter table public.support_events enable row level security;
revoke all on public.support_conversations, public.support_usage, public.support_events from anon, authenticated;

-- The Nka admin reads summaries and cases in /admin/support. Nobody else reads any of this.
grant select on public.support_events to authenticated;
create policy support_events_select on public.support_events for select to authenticated using (public.is_staff());

-- ---------- Sending a message ----------

-- Called before each message goes to Custard. Counts it against today's cap and returns the
-- conversation to carry on, but only if it belongs to this person in this organisation.
create or replace function public.support_begin(p_user uuid, p_org uuid, p_conversation text, p_cap int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_used int;
  v_conv text;
  v_day date := (now() at time zone 'Europe/London')::date;
begin
  select m.role into v_role from public.org_members m where m.org_id = p_org and m.user_id = p_user;
  if v_role is null then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;

  insert into public.support_usage as u (user_id, day, messages) values (p_user, v_day, 1)
  on conflict (user_id, day) do update set messages = u.messages + 1 where u.messages < p_cap
  returning u.messages into v_used;
  if v_used is null then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap');
  end if;

  if p_conversation is not null then
    update public.support_conversations set last_message_at = now()
    where conversation_id = p_conversation and user_id = p_user and org_id = p_org
    returning conversation_id into v_conv;
  end if;

  return jsonb_build_object('ok', true, 'role', v_role, 'conversation', v_conv, 'used', v_used);
end $$;

-- Called with the conversation id Custard returns. True when it is (now) this person's.
create or replace function public.support_remember(p_user uuid, p_org uuid, p_conversation text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.org_members m where m.org_id = p_org and m.user_id = p_user) then
    return false;
  end if;
  insert into public.support_conversations (conversation_id, org_id, user_id)
    values (p_conversation, p_org, p_user)
  on conflict (conversation_id) do nothing;
  return exists (
    select 1 from public.support_conversations
    where conversation_id = p_conversation and user_id = p_user and org_id = p_org);
end $$;

-- ---------- Lookups ----------

-- One person's view of their workspace, or one project when p_project is a project number.
-- Null when the person isn't in that organisation (any more).
create or replace function public.support_lookup(p_user uuid, p_org uuid, p_project bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  o public.orgs%rowtype;
  v_hours jsonb;
  v_lead text;
  v_projects jsonb;
  v_library int;
begin
  select m.role into v_role from public.org_members m where m.org_id = p_org and m.user_id = p_user;
  if v_role is null then return null; end if;
  select * into o from public.orgs where id = p_org;
  if not found then return null; end if;

  if public.on_plan(p_org) then
    v_hours := public.hours_balance(p_org);
  end if;

  -- Same names the workspace shows a client: the designer's alias, or "Nka Studio" for the admin.
  select case when p.is_staff then 'Nka Studio' else coalesce(nullif(p.alias, ''), 'Your designer') end
    into v_lead
  from public.profiles p where p.id = o.lead_id;

  select coalesce(jsonb_agg(to_jsonb(x) - 'sort_at' order by x.sort_at desc), '[]'::jsonb) into v_projects
  from (
    select p.id, p.number, p.title, p.kind, p.status,
           p.deadline as asked_for, p.estimate_due as agreed_date,
           p.submitted_at, p.completed_at, p.updated_at as sort_at,
           (select min(d.released_at) from public.deliverables d
             where d.project_id = p.id and d.released_at is not null) as first_files_at,
           (select count(*) from public.deliverables d
             where d.project_id = p.id and d.status = 'in_review') as files_to_review,
           (select count(*) from public.deliverables d
             where d.project_id = p.id and d.status = 'approved') as approved_files
    from public.projects p
    where p.org_id = p_org
      and (p_project is null or p.number = p_project)
      and (p_project is not null
           or p.status not in ('completed', 'cancelled')
           or p.updated_at > now() - interval '60 days')
    order by p.updated_at desc
    limit case when p_project is null then 12 else 1 end
  ) x;

  select count(*) into v_library from public.deliverables d where d.org_id = p_org and d.status = 'approved';

  return jsonb_build_object(
    'role', v_role,
    'organisation', o.name,
    'plan', o.plan,
    'plan_status', o.plan_status,
    'active_limit', public.effective_limit(p_org),
    'hours', v_hours,
    'instant', jsonb_build_object('used', public.instant_used(p_org), 'limit', public.instant_limit(p_org)),
    'lead', v_lead,
    'projects', v_projects,
    'library_files', v_library);
end $$;

-- Numbers for the owner ("how many clients do we have?"). Test workspaces marked internal don't count.
create or replace function public.support_metrics(p_metric text, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_metric = 'customers' then
    return jsonb_build_object(
      'total_customers', (select count(*) from public.orgs o where not o.internal and public.on_plan(o.id)),
      'new_in_period', (select count(*) from public.orgs o where not o.internal and o.created_at >= p_from and o.created_at < p_to),
      'active_in_period', (select count(distinct p.org_id) from public.projects p join public.orgs o on o.id = p.org_id
                           where not o.internal and p.updated_at >= p_from and p.updated_at < p_to),
      'verified_customers', null);
  elsif p_metric = 'plans' then
    return coalesce((
      select jsonb_agg(jsonb_build_object('plan', plan, 'currency', currency, 'count', n))
      from (select o.plan, o.currency, count(*) as n from public.orgs o
            where not o.internal and public.on_plan(o.id) group by o.plan, o.currency) t), '[]'::jsonb);
  elsif p_metric = 'projects' then
    return jsonb_build_object(
      'briefs_sent', (select count(*) from public.projects p join public.orgs o on o.id = p.org_id
                      where not o.internal and p.submitted_at >= p_from and p.submitted_at < p_to),
      'completed', (select count(*) from public.projects p join public.orgs o on o.id = p.org_id
                    where not o.internal and p.completed_at >= p_from and p.completed_at < p_to),
      'in_production', (select count(*) from public.projects p join public.orgs o on o.id = p.org_id
                        where not o.internal and p.status in ('submitted', 'in_progress', 'changes_requested')),
      'waiting_on_clients', (select count(*) from public.projects p join public.orgs o on o.id = p.org_id
                             where not o.internal and p.status in ('awaiting_approval', 'in_review')));
  end if;
  return null;
end $$;

-- ---------- Access ----------

revoke execute on function public.support_begin(uuid, uuid, text, int), public.support_remember(uuid, uuid, text),
  public.support_lookup(uuid, uuid, bigint), public.support_metrics(text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.support_begin(uuid, uuid, text, int), public.support_remember(uuid, uuid, text),
  public.support_lookup(uuid, uuid, bigint), public.support_metrics(text, timestamptz, timestamptz)
  to service_role;
