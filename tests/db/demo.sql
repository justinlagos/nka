-- Checks for migration 0006: demo requests and workspace setup. One transaction that rolls back.
-- Expect "RESULTS: 9 passed, 0 failed".
do $$
declare
  u uuid := 'c0000000-0000-4000-8000-000000000001';
  u2 uuid := 'c0000000-0000-4000-8000-000000000002';
  res jsonb; res2 jsonb; v_text text; v_int int; passed int := 0; failed int := 0; log text := '';
begin
  -- Anyone can send a demo request; nobody but staff can read it back.
  set local role anon;
  insert into public.demo_requests (email, full_name, phone, company, country, website, about, first_need, volume, team_size, call_time)
    values ('demo@trust.test', 'Ngozi Demo', '+44 7700 900000', 'Acme Foods', 'Nigeria', 'acmefoods.ng', 'We make snacks.', 'Social ads for our Christmas launch', 'steady', '11-50', 'Weekday mornings');
  begin
    select count(*) into v_int from public.demo_requests;
    if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | anon reads demos'; end if;
  exception when others then passed := passed + 1; end;
  begin
    insert into public.demo_requests (email, company, first_need, org_id) values ('x@trust.test', 'X', 'y', gen_random_uuid());
    failed := failed + 1; log := log || ' | anon set org_id';
  exception when others then passed := passed + 1; end;
  reset role;

  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'demo@trust.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
         ('00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated', 'other@trust.test', '{}'::jsonb, '{}'::jsonb, now(), now());

  -- The person who owns the email gets a workspace; a second call returns the same one.
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := public.setup_from_demo();
  res2 := public.setup_from_demo();
  if res->>'org' is not null and res->>'project' is not null and res = res2 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | setup ' || res::text || ' / ' || res2::text; end if;
  select o.name || '/' || o.country || '/' || (o.lead_id is not null)::text into v_text from public.orgs o where o.id = (res->>'org')::uuid;
  if v_text = 'Acme Foods/Nigeria/true' then passed := passed + 1; else failed := failed + 1; log := log || ' | org ' || coalesce(v_text,'null'); end if;
  select about into v_text from public.brand_books where org_id = (res->>'org')::uuid;
  if v_text like 'We make snacks.%Website: acmefoods.ng%Team size: 11-50' then passed := passed + 1; else failed := failed + 1; log := log || ' | about ' || coalesce(v_text,'null'); end if;
  select status || '/' || (brief->>'summary') into v_text from public.projects where id = (res->>'project')::uuid;
  if v_text = 'draft/Social ads for our Christmas launch' then passed := passed + 1; else failed := failed + 1; log := log || ' | project ' || coalesce(v_text,'null'); end if;
  select full_name into v_text from public.profiles where id = u;
  if v_text = 'Ngozi Demo' then passed := passed + 1; else failed := failed + 1; log := log || ' | name ' || v_text; end if;
  reset role;

  -- Someone else signing in gets nothing from it.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := public.setup_from_demo();
  if res->>'org' is null then passed := passed + 1; else failed := failed + 1; log := log || ' | other user got a workspace'; end if;
  select count(*) into v_int from public.orgs;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | other user sees orgs'; end if;
  reset role;
  raise exception 'RESULTS: % passed, % failed%', passed, failed, log;
end $$;
