-- setup_from_demo also returns the website (so the server can read the brand from it) and
-- whether this call made the workspace. The website now goes into brand_books.website.
-- (Function body as applied: see 0006 for the original; this version stores website separately
-- and returns {org, project, website, fresh}.)

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
  if r.set_up_at is not null then
    return jsonb_build_object('org', r.org_id, 'project', r.project_id, 'website', r.website, 'fresh', false);
  end if;

  -- Someone who already owns a workspace gets the new brief there instead of a second workspace.
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
  return jsonb_build_object('org', v_org, 'project', v_project, 'website', r.website, 'fresh', true);
end $$;

revoke execute on function public.setup_from_demo() from public, anon;
grant execute on function public.setup_from_demo() to authenticated;
