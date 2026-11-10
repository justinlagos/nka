-- 0012: designers (talent) and resource partners.
--   * A designer is a talent profile, usually provided by a resource partner (agency or creative group).
--   * Designers see only the clients they lead and the projects assigned to them. The admin (staff) sees everything.
--   * Clients never see who the designer is: only an alias. Designers never see client email addresses.
--   * Designers never set prices. On a paid-up plan they confirm the date and start; otherwise they propose a date
--     and the admin prices it.
--   * New clients get the least busy active designer.
--   * Phone numbers, email addresses and chat or social links can't be shared between clients and designers.

-- ---------------------------------------------------------------------------
-- Partners and designers
-- ---------------------------------------------------------------------------

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  contact_name text not null default '' check (char_length(contact_name) <= 200),
  contact_email text not null default '' check (char_length(contact_email) <= 200),
  share_percent numeric(5, 2) check (share_percent is null or (share_percent >= 0 and share_percent <= 100)),
  agreement text not null default '' check (char_length(agreement) <= 5000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
create policy partners_select on public.partners for select to authenticated using (public.is_staff());

alter table public.profiles add column is_talent boolean not null default false;
alter table public.profiles add column alias text not null default '' check (char_length(alias) <= 60);
alter table public.profiles add column partner_id uuid references public.partners(id) on delete set null;
alter table public.profiles add column talent_active boolean not null default true;

-- Emails that become designers when they first sign in (the admin adds them).
create table public.talent_emails (
  email text primary key check (email = lower(email)),
  alias text not null default '' check (char_length(alias) <= 60),
  partner_id uuid references public.partners(id) on delete set null,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.talent_emails enable row level security;
create policy talent_emails_select on public.talent_emails for select to authenticated using (public.is_staff());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.talent_emails%rowtype;
  v_email text := lower(coalesce(new.email, ''));
  v_staff boolean;
begin
  v_staff := exists (select 1 from public.staff_emails s where s.email = v_email);
  select * into t from public.talent_emails where email = v_email;
  insert into public.profiles (id, email, full_name, is_staff, is_talent, alias, partner_id)
  values (
    new.id, v_email, coalesce(new.raw_user_meta_data->>'full_name', ''), v_staff,
    (not v_staff) and t.email is not null, coalesce(t.alias, ''), t.partner_id
  )
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.is_talent()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_talent and not p.is_staff from public.profiles p where p.id = auth.uid()), false)
$$;

-- A designer works on a client if they lead it or have a live project there.
create or replace function public.talent_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_org is not null and public.is_talent() and (
    exists (select 1 from public.orgs o where o.id = p_org and o.lead_id = auth.uid())
    or exists (select 1 from public.projects p where p.org_id = p_org and p.assignee = auth.uid() and p.status <> 'cancelled')
  )
$$;

create or replace function public.can_view_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_org is not null and (public.is_staff() or public.org_role(p_org) is not null or public.talent_org(p_org))
$$;

-- Write access for the conversation and file uploads: the client team, the admin, or the client's designer.
-- (can_edit_org stays client team and admin only, so designers can't approve their own files.)
create or replace function public.can_work_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_edit_org(p_org) or public.talent_org(p_org)
$$;

revoke execute on function public.is_talent(), public.talent_org(uuid), public.can_work_org(uuid) from public, anon;
grant execute on function public.is_talent(), public.talent_org(uuid), public.can_work_org(uuid) to authenticated;

drop policy comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (
  public.can_work_org(org_id)
  and author = auth.uid()
  and exists (select 1 from public.projects p where p.id = project_id and p.org_id = comments.org_id)
  and (deliverable_id is null or exists (
    select 1 from public.deliverables d where d.id = deliverable_id and d.project_id = comments.project_id))
);
drop policy comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (public.can_work_org(org_id)) with check (public.can_work_org(org_id));

drop policy files_insert on storage.objects;
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.can_work_org(public.try_uuid((storage.foldername(name))[1])));

-- Budgets are between Nka and the client.
drop policy ledger_select on public.budget_ledger;
create policy ledger_select on public.budget_ledger for select to authenticated
  using (public.is_staff() or public.org_role(org_id) is not null);

-- Clients can no longer read studio profiles (names, emails). Names come from display_names().
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_staff()
  or exists (
    select 1 from public.org_members a join public.org_members b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = profiles.id)
);

-- What each person may call everyone else.
--   Clients see a designer's alias ("Your designer" if none) and "Nka Studio" for the admin.
--   Designers see client people by first name only, never an email.
--   The admin sees real names.
create or replace function public.display_names(p_ids uuid[])
returns table (id uuid, name text, studio boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  admin boolean := public.is_staff();
  r record;
begin
  if me is null then return; end if;
  for r in select p.* from public.profiles p where p.id = any(p_ids) loop
    if r.is_staff or r.is_talent then
      id := r.id; studio := true;
      if admin or r.id = me then
        name := coalesce(nullif(r.full_name, ''), split_part(r.email, '@', 1));
      elsif r.is_staff then
        name := 'Nka Studio';
      else
        name := coalesce(nullif(r.alias, ''), 'Your designer');
      end if;
      return next;
    elsif admin or r.id = me or exists (
      select 1 from public.org_members a join public.org_members b on a.org_id = b.org_id
      where a.user_id = me and b.user_id = r.id) then
      id := r.id; studio := false; name := coalesce(nullif(r.full_name, ''), split_part(r.email, '@', 1)); return next;
    elsif public.is_talent() and exists (
      select 1 from public.org_members m where m.user_id = r.id and public.talent_org(m.org_id)) then
      id := r.id; studio := false; name := coalesce(nullif(split_part(trim(r.full_name), ' ', 1), ''), 'Client'); return next;
    end if;
  end loop;
end $$;
revoke execute on function public.display_names(uuid[]) from public, anon;
grant execute on function public.display_names(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- No contact details between clients and designers
-- ---------------------------------------------------------------------------

create or replace function public.has_contact(p text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  t text := lower(coalesce(p, ''));
  m text;
  d text;
begin
  if t = '' then return false; end if;
  -- Email addresses, spelled out or not.
  if t ~ '[a-z0-9._%+\-]+@[a-z0-9\-]+(\.[a-z0-9\-]+)*\.[a-z]{2,}' then return true; end if;
  if t ~ '(@|\(at\)|\[at\]|\mat\M)\s*(gmail|googlemail|yahoo|hotmail|outlook|icloud|proton|protonmail|ymail|aol|live)\M' then return true; end if;
  if t ~ '(\(dot\)|\[dot\]|\mdot (com|co|ng|uk|net|org)\M)' then return true; end if;
  -- Social handles and chat or call links.
  if t ~ '(^|[\s(])@[a-z0-9_.]{2,}' then return true; end if;
  if t ~ '(wa\.me|whatsapp|t\.me/|telegram|signal\.me|instagram\.com|instagr\.am|facebook\.com|fb\.com|fb\.me|messenger\.com|linkedin\.com|twitter\.com|\mx\.com/|tiktok\.com|snapchat|calendly|skype|zoom\.us|meet\.google|discord)' then
    return true;
  end if;
  -- Phone numbers: ten or more digits, starting with + or 0, or written without spaces. Dates and times don't count.
  t := regexp_replace(t, '\d{4}-\d{1,2}-\d{1,2}', ' ', 'g');
  t := regexp_replace(t, '\d{1,2}[/.]\d{1,2}[/.]\d{2,4}', ' ', 'g');
  for m in select (regexp_matches(t, '\+?\d[\d\s().\-]{7,}\d', 'g'))[1] loop
    d := regexp_replace(m, '\D', '', 'g');
    if length(d) >= 10 and (left(m, 1) in ('+', '0') or m !~ '\s') then return true; end if;
  end loop;
  return false;
end $$;

-- Replaces contact details with "[removed]". Used where text arrives without a person to ask (brand books
-- read from a website, demo forms).
create or replace function public.mask_contact(p text)
returns text language plpgsql immutable set search_path = public as $$
declare
  t text := coalesce(p, '');
  m text;
begin
  if not public.has_contact(t) then return t; end if;
  t := regexp_replace(t, '[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}', '[removed]', 'g');
  t := regexp_replace(t, '(^|[\s(])@[A-Za-z0-9_.]{2,}', '\1[removed]', 'g');
  t := regexp_replace(t, '\S*(wa\.me|whatsapp|t\.me/|telegram|signal\.me|instagram\.com|instagr\.am|facebook\.com|fb\.com|fb\.me|messenger\.com|linkedin\.com|twitter\.com|x\.com/|tiktok\.com|snapchat|calendly|skype|zoom\.us|meet\.google|discord)\S*', '[removed]', 'gi');
  for m in select (regexp_matches(t, '\+?\d[\d\s().\-]{7,}\d', 'g'))[1] loop
    if length(regexp_replace(m, '\D', '', 'g')) >= 10 and (left(m, 1) in ('+', '0') or m !~ '\s') then
      t := replace(t, m, '[removed]');
    end if;
  end loop;
  return t;
end $$;

create or replace function public.guard_contact()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  txt text;
begin
  -- Brand books are read by the designer: mask anything that slips in, from any source except the admin.
  if tg_table_name = 'brand_books' then
    if auth.uid() is not null and public.is_staff() then return new; end if;
    new.about := public.mask_contact(new.about);
    new.audiences := public.mask_contact(new.audiences);
    new.voice := public.mask_contact(new.voice);
    new.rules := public.mask_contact(new.rules);
    return new;
  end if;
  -- The admin and Nka itself (server jobs) may write anything.
  if auth.uid() is null or public.is_staff() then return new; end if;
  if tg_table_name = 'comments' then
    txt := new.body;
  elsif tg_table_name = 'deliverables' then
    txt := concat_ws(' ', new.title, new.note);
  elsif tg_table_name = 'projects' then
    if new.status = 'draft' then return new; end if;
    if tg_op = 'UPDATE' and old.status <> 'draft'
       and new.title is not distinct from old.title
       and new.brief is not distinct from old.brief
       and new.estimate_notes is not distinct from old.estimate_notes then
      return new;
    end if;
    txt := concat_ws(' ', new.title, new.brief::text, new.estimate_notes);
  end if;
  if public.has_contact(txt) then
    raise exception 'Contact details can''t be shared on Nka. Take out phone numbers, email addresses and social or chat links, and keep the conversation here.'
      using errcode = '22023';
  end if;
  return new;
end $$;

create trigger comments_guard_contact before insert or update of body on public.comments
  for each row execute function public.guard_contact();
create trigger deliverables_guard_contact before insert or update of title, note on public.deliverables
  for each row execute function public.guard_contact();
create trigger brand_books_guard_contact before insert or update on public.brand_books
  for each row execute function public.guard_contact();
create trigger projects_guard_contact before insert or update on public.projects
  for each row execute function public.guard_contact();

-- ---------------------------------------------------------------------------
-- Who does what on a project
-- ---------------------------------------------------------------------------

-- Admin, or the designer who leads this client or has this project.
create or replace function public.require_studio_project(p_project uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_staff() then return; end if;
  if public.is_talent() and exists (
    select 1 from public.projects p join public.orgs o on o.id = p.org_id
    where p.id = p_project and (p.assignee = auth.uid() or o.lead_id = auth.uid())) then
    return;
  end if;
  raise exception 'Only this client''s designer or the Nka admin can do that.' using errcode = '42501';
end $$;
revoke execute on function public.require_studio_project(uuid) from public, anon;
grant execute on function public.require_studio_project(uuid) to authenticated;

create or replace function public.is_designer(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_user and (is_staff or (is_talent and talent_active)))
$$;

-- Designers never set a price. On a paid-up plan they confirm and start. Otherwise they propose the
-- date and hours, and the admin adds the price and sends it.
create or replace function public.staff_send_estimate(
  p_project uuid, p_amount numeric, p_hours numeric, p_due date, p_notes text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  o public.orgs%rowtype;
  v_admin boolean := public.is_staff();
  v_plan boolean;
begin
  perform public.require_studio_project(p_project);
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found.' using errcode = '22023'; end if;
  if v.status not in ('submitted', 'awaiting_approval') then
    raise exception 'Estimates go on submitted projects. Once approved, the price is fixed.' using errcode = '22023';
  end if;
  select * into o from public.orgs where id = v.org_id;
  v_plan := o.plan in ('starter', 'growth', 'studio') and o.plan_status in ('active', 'trialing');

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
    estimate_amount = case when v_admin then p_amount when v_plan then 0 else null end,
    estimate_hours = p_hours, estimate_due = p_due,
    estimate_notes = coalesce(p_notes, ''), estimate_sent_at = now(), status = 'awaiting_approval',
    assignee = coalesce(assignee, case when v_admin then null else auth.uid() end)
  where id = p_project;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, auth.uid(), 'estimate_sent',
            jsonb_build_object('amount', case when v_admin then p_amount else 0 end, 'hours', p_hours, 'due', p_due));
  if v.auto_approve or v_plan then
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
  perform public.require_studio_project(p_project);
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found.' using errcode = '22023'; end if;
  if p_status not in ('submitted', 'in_progress', 'in_review', 'changes_requested', 'completed', 'cancelled', 'queued') then
    raise exception 'Unknown status.' using errcode = '22023';
  end if;
  if not public.is_staff() and p_status in ('cancelled', 'queued', 'submitted') then
    raise exception 'Ask the Nka admin to cancel or requeue a project.' using errcode = '42501';
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
  if p_user is not null and not public.is_designer(p_user) then
    raise exception 'Assign a designer or the admin.' using errcode = '22023';
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
  perform public.require_studio_project(p_project);
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

-- ---------------------------------------------------------------------------
-- Automatic assignment: the least busy active designer
-- ---------------------------------------------------------------------------

create or replace function public.pick_designer()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  where p.is_talent and p.talent_active and not p.is_staff
  order by
    (select count(*) from public.projects pr where pr.assignee = p.id
       and pr.status in ('submitted', 'awaiting_approval', 'in_progress', 'in_review', 'changes_requested')),
    (select count(*) from public.orgs o where o.lead_id = p.id),
    p.created_at
  limit 1
$$;
revoke execute on function public.pick_designer() from public, anon, authenticated;

-- Gives a client a lead if it has none. Falls back to the admin so nobody is left without one.
create or replace function public.assign_lead(p_org uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_lead uuid;
begin
  if exists (select 1 from public.orgs where id = p_org and lead_id is not null) then
    select lead_id into v_lead from public.orgs where id = p_org; return v_lead;
  end if;
  v_lead := coalesce(public.pick_designer(), (select id from public.profiles where is_staff order by created_at limit 1));
  if v_lead is not null then
    update public.orgs set lead_id = v_lead, lead_since = now() where id = p_org;
    insert into public.lead_changes (org_id, from_user, to_user, note, changed_by) values (p_org, null, v_lead, '', auth.uid());
  end if;
  return v_lead;
end $$;
revoke execute on function public.assign_lead(uuid) from public, anon, authenticated;

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
  if not public.is_staff() then perform public.assign_lead(v_org); end if;
  return v_org;
end $$;

create or replace function public.setup_from_demo()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  r public.demo_requests%rowtype;
  v_org uuid;
  v_project uuid;
  v_about text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select email into v_email from public.profiles where id = auth.uid();

  select * into r from public.demo_requests
    where email = v_email and created_at > now() - interval '2 days'
    order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('org', null, 'project', null); end if;
  if r.set_up_at is not null then
    return jsonb_build_object('org', r.org_id, 'project', r.project_id, 'website', r.website, 'fresh', false);
  end if;

  select m.org_id into v_org from public.org_members m
    where m.user_id = auth.uid() and m.role = 'owner' order by m.created_at limit 1;

  if v_org is null then
    insert into public.orgs (name, country, created_by) values (trim(r.company), r.country, auth.uid()) returning id into v_org;
    insert into public.org_members (org_id, user_id, role) values (v_org, auth.uid(), 'owner');
    v_about := trim(both E'\n' from concat_ws(E'\n',
      nullif(trim(r.about), ''),
      case when r.team_size <> '' then 'Team size: ' || r.team_size end));
    insert into public.brand_books (org_id, about, website, updated_by)
      values (v_org, coalesce(v_about, ''), left(trim(r.website), 300), auth.uid());
    perform public.assign_lead(v_org);
  end if;

  update public.profiles set full_name = trim(r.full_name)
    where id = auth.uid() and full_name = '' and trim(r.full_name) <> '';

  insert into public.projects (org_id, title, brief, created_by)
    values (v_org, 'First brief', jsonb_build_object('summary', trim(r.first_need)), auth.uid())
    returning id into v_project;

  update public.demo_requests set org_id = v_org, project_id = v_project, set_up_at = now() where id = r.id;
  return jsonb_build_object('org', v_org, 'project', v_project, 'website', r.website, 'fresh', true);
end $$;
revoke execute on function public.setup_from_demo() from public, anon;
grant execute on function public.setup_from_demo() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: designers and partners
-- ---------------------------------------------------------------------------

create or replace function public.admin_save_partner(
  p_id uuid, p_name text, p_contact_name text, p_contact_email text, p_share numeric, p_agreement text, p_active boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := p_id;
begin
  perform public.require_staff();
  if coalesce(trim(p_name), '') = '' then raise exception 'Add the partner''s name.' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.partners (name, contact_name, contact_email, share_percent, agreement, active)
      values (trim(p_name), coalesce(trim(p_contact_name), ''), lower(coalesce(trim(p_contact_email), '')), p_share,
              coalesce(p_agreement, ''), coalesce(p_active, true))
      returning id into v_id;
  else
    update public.partners set name = trim(p_name), contact_name = coalesce(trim(p_contact_name), ''),
      contact_email = lower(coalesce(trim(p_contact_email), '')), share_percent = p_share,
      agreement = coalesce(p_agreement, ''), active = coalesce(p_active, true)
    where id = v_id;
  end if;
  return v_id;
end $$;

-- Adds a designer by email. They become a designer when they sign in (or straight away if they already have).
create or replace function public.admin_add_designer(p_email text, p_alias text, p_partner uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  perform public.require_staff();
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address.' using errcode = '22023'; end if;
  if exists (select 1 from public.staff_emails where email = v_email) then
    raise exception 'That email is an admin. Use another address for the designer account.' using errcode = '22023';
  end if;
  insert into public.talent_emails (email, alias, partner_id, added_by)
    values (v_email, coalesce(trim(p_alias), ''), p_partner, auth.uid())
    on conflict (email) do update set alias = excluded.alias, partner_id = excluded.partner_id;
  update public.profiles set is_talent = true, alias = coalesce(trim(p_alias), ''), partner_id = p_partner
    where email = v_email and not is_staff;
  return case when found then 'ready' else 'invited' end;
end $$;

create or replace function public.admin_set_designer(p_user uuid, p_alias text, p_partner uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  update public.profiles set alias = coalesce(trim(p_alias), ''), partner_id = p_partner, talent_active = coalesce(p_active, true)
    where id = p_user and is_talent;
  if not found then raise exception 'Designer not found.' using errcode = '22023'; end if;
end $$;

revoke execute on function public.admin_save_partner(uuid, text, text, text, numeric, text, boolean),
  public.admin_add_designer(text, text, uuid), public.admin_set_designer(uuid, text, uuid, boolean) from public, anon;
grant execute on function public.admin_save_partner(uuid, text, text, text, numeric, text, boolean),
  public.admin_add_designer(text, text, uuid), public.admin_set_designer(uuid, text, uuid, boolean) to authenticated;
