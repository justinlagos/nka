-- 0006: book a demo and get a ready workspace. A visitor answers a few questions, confirms
-- their email with a code, and their workspace is built from the answers: organisation,
-- brand basics, a named designer and a first brief draft.

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and position('@' in email) > 1 and char_length(email) <= 200),
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text not null default '' check (char_length(phone) <= 40),
  company text not null check (char_length(company) between 1 and 160),
  country text not null default '' check (char_length(country) <= 80),
  website text not null default '' check (char_length(website) <= 300),
  about text not null default '' check (char_length(about) <= 2000),
  first_need text not null check (char_length(first_need) between 1 and 4000),
  volume text not null default '' check (char_length(volume) <= 60),
  team_size text not null default '' check (char_length(team_size) <= 40),
  call_time text not null default '' check (char_length(call_time) <= 200),
  org_id uuid references public.orgs(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  set_up_at timestamptz,
  created_at timestamptz not null default now()
);
create index demo_requests_email_idx on public.demo_requests(email, created_at desc);
alter table public.demo_requests enable row level security;

grant insert (email, full_name, phone, company, country, website, about, first_need, volume, team_size, call_time)
  on public.demo_requests to anon, authenticated;
create policy demo_insert on public.demo_requests for insert to anon, authenticated
  with check (org_id is null and project_id is null and set_up_at is null);
create policy demo_select on public.demo_requests for select to authenticated using (public.is_staff());

-- Builds the workspace for the signed-in person from their most recent demo answers (last 2 days).
-- Safe to call twice: the second call returns what the first one made.
create or replace function public.setup_from_demo()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  r public.demo_requests%rowtype;
  v_org uuid;
  v_project uuid;
  v_lead uuid;
  v_about text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select email into v_email from public.profiles where id = auth.uid();

  select * into r from public.demo_requests
    where email = v_email and created_at > now() - interval '2 days'
    order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('org', null, 'project', null); end if;
  if r.set_up_at is not null then return jsonb_build_object('org', r.org_id, 'project', r.project_id); end if;

  -- Someone who already owns a workspace gets the new brief there instead of a second workspace.
  select m.org_id into v_org from public.org_members m
    where m.user_id = auth.uid() and m.role = 'owner' order by m.created_at limit 1;

  if v_org is null then
    insert into public.orgs (name, country, created_by) values (trim(r.company), r.country, auth.uid()) returning id into v_org;
    insert into public.org_members (org_id, user_id, role) values (v_org, auth.uid(), 'owner');
    v_about := trim(both E'\n' from concat_ws(E'\n',
      nullif(trim(r.about), ''),
      case when trim(r.website) <> '' then 'Website: ' || trim(r.website) end,
      case when r.team_size <> '' then 'Team size: ' || r.team_size end));
    insert into public.brand_books (org_id, about, updated_by) values (v_org, coalesce(v_about, ''), auth.uid());
    -- Name the studio's first designer as lead so the client sees who they're working with.
    select id into v_lead from public.profiles where is_staff order by created_at limit 1;
    if v_lead is not null then
      update public.orgs set lead_id = v_lead, lead_since = now() where id = v_org;
      insert into public.lead_changes (org_id, from_user, to_user, note, changed_by)
        values (v_org, null, v_lead, '', auth.uid());
    end if;
  end if;

  update public.profiles set full_name = trim(r.full_name)
    where id = auth.uid() and full_name = '' and trim(r.full_name) <> '';

  insert into public.projects (org_id, title, brief, created_by)
    values (v_org, 'First brief', jsonb_build_object('summary', trim(r.first_need)), auth.uid())
    returning id into v_project;

  update public.demo_requests set org_id = v_org, project_id = v_project, set_up_at = now() where id = r.id;
  return jsonb_build_object('org', v_org, 'project', v_project);
end $$;

revoke execute on function public.setup_from_demo() from public, anon;
grant execute on function public.setup_from_demo() to authenticated;
