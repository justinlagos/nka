-- Checks for migration 0015: API accounts, keys, jobs, limits and card opens.
-- One transaction that always rolls back. Expect "RESULTS: N passed, 0 failed".
do $$
declare
  u_owner    uuid := 'c0000000-0000-4000-8000-000000000001';
  u_member   uuid := 'c0000000-0000-4000-8000-000000000002';
  u_staff    uuid := 'c0000000-0000-4000-8000-000000000003';
  u_outsider uuid := 'c0000000-0000-4000-8000-000000000004';
  h1 text := repeat('a', 64); h2 text := repeat('b', 64); h_other text := repeat('c', 64);
  secret text := repeat('s', 40);
  v_org uuid; v_org2 uuid; k1 uuid; k2 uuid; v_card uuid;
  v_json jsonb; v_int int; v_id uuid; v_text text;
  passed int := 0; failed int := 0; log text := '';
begin
  insert into public.staff_emails values ('s@api.test') on conflict do nothing;
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.email,
         jsonb_build_object('full_name', x.name), '{}'::jsonb, now(), now()
  from (values (u_owner, 'owner@api.test', 'Ada Owner'), (u_member, 'member@api.test', 'Mo Member'),
               (u_staff, 's@api.test', 'Nka Staff'), (u_outsider, 'out@api.test', 'Dee Outsider')) as x(id, email, name);

  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_org := public.create_org('API Co', 'United Kingdom');
  reset role;
  insert into public.org_members (org_id, user_id, role) values (v_org, u_member, 'member');
  perform set_config('request.jwt.claims', json_build_object('sub', u_outsider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_org2 := public.create_org('Other Co', 'Nigeria');
  reset role;

  -- 1. No keys until Nka switches the API on
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.create_api_key(v_org, 'Too early', 'nka_live_aaaaaa', h1, secret);
    failed := failed + 1; log := log || ' | key made while API off';
  exception when others then passed := passed + 1; end;

  -- 2. A client can't switch the API on for themselves
  begin
    perform public.staff_set_api(v_org, true, 100000, 600);
    failed := failed + 1; log := log || ' | client enabled own API';
  exception when others then passed := passed + 1; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.staff_set_api(v_org, true, 10, 3);
  perform public.staff_set_api(v_org2, true, 10, 3);
  reset role;

  -- 3. Members can't make keys; owners can
  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.create_api_key(v_org, 'Member key', 'nka_live_aaaaaa', h1, secret);
    failed := failed + 1; log := log || ' | member made a key';
  exception when others then passed := passed + 1; end;
  -- 4. Members can't see keys at all
  select count(*) into v_int from (select id from public.api_keys) x;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | member sees keys'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  k1 := public.create_api_key(v_org, 'Production', 'nka_live_aaaaaa', h1, secret);
  k2 := public.create_api_key(v_org, 'Second', 'nka_live_bbbbbb', h2, secret);
  if k1 is not null and k2 is not null then passed := passed + 1; else failed := failed + 1; log := log || ' | owner key'; end if;

  -- 5. The hash and the webhook secret can't be read from a browser session, even by the owner
  begin
    select key_hash into v_text from public.api_keys where id = k1;
    failed := failed + 1; log := log || ' | owner read key hash';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin
    select webhook_secret into v_text from public.api_keys where id = k1;
    failed := failed + 1; log := log || ' | owner read webhook secret';
  exception when insufficient_privilege then passed := passed + 1; end;
  select prefix into v_text from public.api_keys where id = k1;
  if v_text = 'nka_live_aaaaaa' then passed := passed + 1; else failed := failed + 1; log := log || ' | prefix not readable'; end if;

  -- 6. The job functions are for the server only
  begin
    perform public.api_begin_job(h1, 'brand_check', 1, '{}'::jsonb);
    failed := failed + 1; log := log || ' | browser started a job';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin
    perform public.api_auth(h1);
    failed := failed + 1; log := log || ' | browser called api_auth';
  exception when insufficient_privilege then passed := passed + 1; end;
  -- 7. And a browser can't write jobs or accounts directly
  begin
    insert into public.api_jobs (org_id, endpoint, status, units) values (v_org, 'brand_check', 'succeeded', 0);
    failed := failed + 1; log := log || ' | browser inserted a job';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin
    update public.api_accounts set monthly_credits = 999999 where org_id = v_org;
    failed := failed + 1; log := log || ' | browser raised own credits';
  exception when insufficient_privilege then passed := passed + 1; end;
  reset role;

  -- From here on: the server, with the service role
  set local role service_role;

  -- 8. A key resolves to its organisation; an unknown one to nothing
  v_json := public.api_auth(h1);
  if (v_json->>'org_id')::uuid = v_org and (v_json->>'monthly_credits')::int = 10 then passed := passed + 1; else failed := failed + 1; log := log || ' | api_auth ' || coalesce(v_json::text, 'null'); end if;
  if public.api_auth(h_other) is null then passed := passed + 1; else failed := failed + 1; log := log || ' | unknown key accepted'; end if;
  v_json := public.api_begin_job(h_other, 'brand_check', 1, '{}'::jsonb);
  if v_json->>'error' = 'invalid_key' then passed := passed + 1; else failed := failed + 1; log := log || ' | unknown key began a job'; end if;

  -- 9. A job starts; the same idempotency key returns it again; a different endpoint is refused
  v_json := public.api_begin_job(h1, 'brand_check', 1, '{"a":1}'::jsonb, 'idem-1', 'https://example.com/hook');
  v_id := (v_json->'job'->>'id')::uuid;
  if v_id is not null and (v_json->>'replayed')::boolean = false and v_json->'job'->>'status' = 'queued' then passed := passed + 1; else failed := failed + 1; log := log || ' | begin ' || v_json::text; end if;
  v_json := public.api_begin_job(h1, 'brand_check', 1, '{"a":2}'::jsonb, 'idem-1');
  if (v_json->'job'->>'id')::uuid = v_id and (v_json->>'replayed')::boolean then passed := passed + 1; else failed := failed + 1; log := log || ' | replay made a new job'; end if;
  v_json := public.api_begin_job(h1, 'document', 3, '{}'::jsonb, 'idem-1');
  if v_json->>'error' = 'idempotency_mismatch' then passed := passed + 1; else failed := failed + 1; log := log || ' | idempotency mismatch allowed'; end if;
  -- The same idempotency key in another organisation is a different job
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_outsider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.create_api_key(v_org2, 'Other', 'nka_live_cccccc', h_other, secret);
  reset role;
  set local role service_role;
  v_json := public.api_begin_job(h_other, 'brand_check', 1, '{}'::jsonb, 'idem-1');
  if (v_json->'job'->>'id')::uuid <> v_id and (v_json->>'replayed')::boolean = false then passed := passed + 1; else failed := failed + 1; log := log || ' | idempotency crossed organisations'; end if;

  -- 10. Rate limit: 3 a minute per key. The other key is unaffected.
  perform public.api_begin_job(h1, 'brand_check', 1, '{}'::jsonb);
  perform public.api_begin_job(h1, 'brand_check', 1, '{}'::jsonb);
  v_json := public.api_begin_job(h1, 'brand_check', 1, '{}'::jsonb);
  if v_json->>'error' = 'rate_limited' then passed := passed + 1; else failed := failed + 1; log := log || ' | 4th request in a minute allowed'; end if;
  v_json := public.api_begin_job(h2, 'brand_check', 1, '{}'::jsonb);
  if v_json ? 'job' then passed := passed + 1; else failed := failed + 1; log := log || ' | second key was limited too'; end if;

  -- 11. Credits: 4 used of 10. A 7-credit job is refused; a failed job gives its credits back.
  if public.api_credits_used(v_org) = 4 then passed := passed + 1; else failed := failed + 1; log := log || ' | used ' || public.api_credits_used(v_org); end if;
  v_json := public.api_begin_job(h2, 'brand_guidelines', 7, '{}'::jsonb);
  if v_json->>'error' = 'quota_exceeded' then passed := passed + 1; else failed := failed + 1; log := log || ' | went over quota'; end if;
  update public.api_jobs set status = 'failed' where id = v_id;
  if public.api_credits_used(v_org) = 3 then passed := passed + 1; else failed := failed + 1; log := log || ' | failed job still charged'; end if;
  v_json := public.api_begin_job(h2, 'brand_guidelines', 7, '{}'::jsonb);
  if v_json ? 'job' then passed := passed + 1; else failed := failed + 1; log := log || ' | exact quota refused: ' || v_json::text; end if;
  -- Last month's jobs don't count
  update public.api_jobs set created_at = now() - interval '40 days' where org_id = v_org;
  if public.api_credits_used(v_org) = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | old jobs counted'; end if;
  reset role;

  -- 12. Each organisation sees only its own jobs, and never the input or output
  perform set_config('request.jwt.claims', json_build_object('sub', u_outsider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from (select id from public.api_jobs where org_id = v_org) x;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | outsider sees jobs'; end if;
  if public.my_api_credits_used(v_org) = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | outsider sees usage'; end if;
  begin
    perform public.revoke_api_key(k1);
    failed := failed + 1; log := log || ' | outsider revoked a key';
  exception when others then passed := passed + 1; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from (select id from public.api_jobs where org_id = v_org) x;
  if v_int >= 5 then passed := passed + 1; else failed := failed + 1; log := log || ' | member can''t see own org jobs'; end if;
  begin
    select input::text into v_text from public.api_jobs limit 1;
    failed := failed + 1; log := log || ' | browser read job input';
  exception when insufficient_privilege then passed := passed + 1; end;
  reset role;

  -- 13. A revoked key stops at once; so does switching the API off
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.revoke_api_key(k1);
  reset role;
  set local role service_role;
  if public.api_auth(h1) is null and public.api_begin_job(h1, 'brand_check', 1, '{}'::jsonb)->>'error' = 'invalid_key' then passed := passed + 1; else failed := failed + 1; log := log || ' | revoked key still works'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.staff_set_api(v_org, false, 10, 3);
  reset role;
  set local role service_role;
  if public.api_auth(h2) is null and public.api_begin_job(h2, 'brand_check', 1, '{}'::jsonb)->>'error' = 'api_disabled' then passed := passed + 1; else failed := failed + 1; log := log || ' | disabled API still works'; end if;

  -- 14. Cards: opens are counted per recipient; nobody reads cards from a browser
  insert into public.ecards (org_id, spec) values (v_org, '{"brand":"API Co"}'::jsonb) returning id into v_card;
  insert into public.ecard_recipients (token, ecard_id, name) values ('tokenAAAAAAAAAAAAAAAA1', v_card, 'Chidi'), ('tokenAAAAAAAAAAAAAAAA2', v_card, 'Bola');
  perform public.ecard_opened('tokenAAAAAAAAAAAAAAAA1');
  perform public.ecard_opened('tokenAAAAAAAAAAAAAAAA1');
  perform public.ecard_opened('no-such-token-000000');
  select opens into v_int from public.ecard_recipients where token = 'tokenAAAAAAAAAAAAAAAA1';
  if v_int = 2 and (select opens from public.ecard_recipients where token = 'tokenAAAAAAAAAAAAAAAA2') = 0
     and (select first_opened_at is not null from public.ecard_recipients where token = 'tokenAAAAAAAAAAAAAAAA1')
  then passed := passed + 1; else failed := failed + 1; log := log || ' | opens ' || v_int; end if;
  begin
    insert into public.ecard_recipients (token, ecard_id, name) values ('short', v_card, 'x');
    failed := failed + 1; log := log || ' | weak token stored';
  exception when check_violation then passed := passed + 1; end;
  reset role;
  set local role anon;
  begin
    select count(*) into v_int from public.ecard_recipients;
    failed := failed + 1; log := log || ' | anon read recipients';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin
    perform public.ecard_opened('tokenAAAAAAAAAAAAAAAA2');
    failed := failed + 1; log := log || ' | anon counted an open directly';
  exception when insufficient_privilege then passed := passed + 1; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    select count(*) into v_int from public.ecards;
    failed := failed + 1; log := log || ' | browser read cards';
  exception when insufficient_privilege then passed := passed + 1; end;
  reset role;

  -- 15. The private bucket exists
  if exists (select 1 from storage.buckets where id = 'api' and public = false) then passed := passed + 1; else failed := failed + 1; log := log || ' | api bucket missing or public'; end if;

  raise exception 'RESULTS: % passed, % failed%', passed, failed, log;
end $$;
