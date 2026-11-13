-- Checks for migration 0015: Abigail's lookups, conversations and daily cap.
-- One transaction that always rolls back. Expect "RESULTS: N passed, 0 failed".
do $$
declare
  u_owner  uuid := 'f0000000-0000-4000-8000-000000000001';
  u_viewer uuid := 'f0000000-0000-4000-8000-000000000002';
  u_other  uuid := 'f0000000-0000-4000-8000-000000000003';  -- owner of another client
  u_admin  uuid := 'f0000000-0000-4000-8000-000000000004';
  u_des    uuid := 'f0000000-0000-4000-8000-000000000005';
  o1 uuid; o2 uuid; o_int uuid; p1 uuid; p2 uuid; p_other uuid; n1 bigint; n_other bigint;
  v_json jsonb; v_bool boolean; v_int int;
  passed int := 0; failed int := 0; log text := '';
begin
  insert into public.staff_emails values ('admin@support.test') on conflict do nothing;
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.email,
         jsonb_build_object('full_name', x.name), '{}'::jsonb, now(), now()
  from (values (u_owner, 'owner@support.test', 'Ada Owner'), (u_viewer, 'viewer@support.test', 'Chi Viewer'),
               (u_other, 'other@support.test', 'Dee Other'), (u_admin, 'admin@support.test', 'Nka Admin'),
               (u_des, 'des@support.test', 'Real Designer Name')) as x(id, email, name);
  update public.profiles set is_talent = true, alias = 'Kemi' where id = u_des;

  -- Two clients and an internal test workspace
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  o1 := public.create_org('Support Co', 'United Kingdom');
  insert into public.projects (org_id, title, brief, created_by) values (o1, 'Launch posts', '{"summary":"Six posts"}', u_owner) returning id, number into p1, n1;
  insert into public.projects (org_id, title, brief, created_by) values (o1, 'Old flyer', '{"summary":"A flyer"}', u_owner) returning id into p2;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  o2 := public.create_org('Other Co', 'Nigeria');
  insert into public.projects (org_id, title, brief, created_by) values (o2, 'Secret rebrand', '{"summary":"x"}', u_other) returning id, number into p_other, n_other;
  o_int := public.create_org('Internal test', 'United Kingdom');
  reset role;
  perform set_config('request.jwt.claims', '', true);

  insert into public.org_members (org_id, user_id, role) values (o1, u_viewer, 'viewer');
  update public.orgs set plan = 'growth', plan_status = 'active', lead_id = u_des where id = o1;
  update public.orgs set plan = 'starter', plan_status = 'active' where id in (o2, o_int);
  update public.orgs set internal = true where id = o_int;
  update public.projects set status = 'in_progress', estimate_due = current_date + 3, submitted_at = now() where id = p1;
  -- Finished long ago: skip the trigger that would stamp updated_at with now().
  set local session_replication_role = replica;
  update public.projects set status = 'completed', completed_at = now() - interval '200 days', updated_at = now() - interval '200 days' where id = p2;
  set local session_replication_role = origin;
  insert into public.deliverables (project_id, org_id, title, storage_path, file_name, status, released_at)
    values (p1, o1, 'Post 1', o1 || '/d/1.png', '1.png', 'in_review', now()),
           (p1, o1, 'Post 2', o1 || '/d/2.png', '2.png', 'internal_review', null),
           (p1, o1, 'Post 0', o1 || '/d/0.png', '0.png', 'approved', now() - interval '1 day');

  -- 1-4. Browsers can't call any of it, signed in or not
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.support_lookup(u_other, o2, null); failed := failed + 1; log := log || ' | client ran a lookup';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform public.support_begin(u_owner, o1, null, 100); failed := failed + 1; log := log || ' | client ran begin';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform public.support_remember(u_owner, o1, 'conv-x'); failed := failed + 1; log := log || ' | client ran remember';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform public.support_metrics('customers', now() - interval '1 day', now()); failed := failed + 1; log := log || ' | client ran metrics';
  exception when insufficient_privilege then passed := passed + 1; end;
  reset role;
  set local role anon;
  begin perform public.support_lookup(u_owner, o1, null); failed := failed + 1; log := log || ' | anon ran a lookup';
  exception when insufficient_privilege then passed := passed + 1; end;
  reset role;

  -- From here on, the server
  perform set_config('request.jwt.claims', '', true);
  set local role service_role;

  -- 5. A member sees their own workspace
  v_json := public.support_lookup(u_owner, o1, null);
  if v_json->>'organisation' = 'Support Co' and v_json->>'plan' = 'growth' and v_json->>'role' = 'owner'
     and (v_json->'hours'->>'left')::numeric = 20 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | owner lookup ' || coalesce(v_json::text, 'null'); end if;

  -- 6. The lead designer is the alias, never the real name
  if v_json->>'lead' = 'Kemi' and v_json::text not like '%Real Designer Name%' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | lead ' || coalesce(v_json->>'lead', 'null'); end if;

  -- 7. Versions in Nka's internal review don't show; released ones do
  if (v_json->'projects'->0->>'files_to_review')::int = 1 and (v_json->'projects'->0->>'approved_files')::int = 1
     and (v_json->>'library_files')::int = 1 and v_json->'projects'->0->>'first_files_at' is not null then passed := passed + 1;
  else failed := failed + 1; log := log || ' | files ' || coalesce((v_json->'projects'->0)::text, 'null'); end if;

  -- 8. Old finished work drops off the list
  if jsonb_array_length(v_json->'projects') = 1 and v_json->'projects'->0->>'title' = 'Launch posts' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | projects listed ' || jsonb_array_length(v_json->'projects'); end if;

  -- 9. A viewer gets the same workspace view
  v_json := public.support_lookup(u_viewer, o1, null);
  if v_json->>'role' = 'viewer' and v_json->>'organisation' = 'Support Co' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | viewer lookup'; end if;

  -- 10. Someone outside the organisation gets nothing
  if public.support_lookup(u_other, o1, null) is null then passed := passed + 1;
  else failed := failed + 1; log := log || ' | outsider saw Support Co'; end if;

  -- 11. Another client's project number finds nothing
  v_json := public.support_lookup(u_owner, o1, n_other);
  if jsonb_array_length(v_json->'projects') = 0 and v_json::text not like '%Secret rebrand%' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | crossed into another client''s project'; end if;

  -- 12. A project by number, including old finished work
  v_json := public.support_lookup(u_owner, o1, n1);
  if jsonb_array_length(v_json->'projects') = 1 and (v_json->'projects'->0->>'number')::bigint = n1 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | project by number'; end if;

  -- 13. Not a member: no message counted
  v_json := public.support_begin(u_other, o1, null, 100);
  if v_json->>'ok' = 'false' and v_json->>'reason' = 'not_member' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | begin for outsider ' || v_json::text; end if;

  -- 14. The daily cap holds
  perform public.support_begin(u_owner, o1, null, 2);
  perform public.support_begin(u_owner, o1, null, 2);
  v_json := public.support_begin(u_owner, o1, null, 2);
  if v_json->>'reason' = 'daily_cap' and (select messages from public.support_usage where user_id = u_owner) = 2 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | cap ' || v_json::text; end if;

  -- 15. A conversation belongs to one person in one organisation
  v_bool := public.support_remember(u_owner, o1, 'conv-1');
  if v_bool and not public.support_remember(u_viewer, o1, 'conv-1') and not public.support_remember(u_other, o2, 'conv-1') then passed := passed + 1;
  else failed := failed + 1; log := log || ' | conversation claimed twice'; end if;

  -- 16. Only its owner carries it on
  v_json := public.support_begin(u_viewer, o1, 'conv-1', 100);
  if v_json->>'ok' = 'true' and v_json->'conversation' = 'null'::jsonb then passed := passed + 1;
  else failed := failed + 1; log := log || ' | viewer carried on owner''s chat ' || v_json::text; end if;
  v_json := public.support_begin(u_owner, o1, 'conv-1', 100);
  if v_json->>'conversation' = 'conv-1' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | owner lost their chat ' || v_json::text; end if;

  -- 17. Removed from the organisation: no lookups, no messages
  reset role;
  delete from public.org_members where org_id = o1 and user_id = u_viewer;
  set local role service_role;
  if public.support_lookup(u_viewer, o1, null) is null and public.support_begin(u_viewer, o1, null, 100)->>'reason' = 'not_member' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | removed member still served'; end if;

  -- 18. Owner numbers leave out internal workspaces
  v_json := public.support_metrics('customers', now() - interval '1 day', now() + interval '1 minute');
  if (v_json->>'total_customers')::int = 2 and (v_json->>'new_in_period')::int = 2 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | customers ' || v_json::text; end if;
  v_json := public.support_metrics('plans', now() - interval '1 day', now());
  if jsonb_array_length(v_json) = 2 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | plans ' || v_json::text; end if;
  if public.support_metrics('nonsense', now(), now()) is null then passed := passed + 1;
  else failed := failed + 1; log := log || ' | unknown metric answered'; end if;
  reset role;

  -- 19. Only the Nka admin reads summaries and cases
  insert into public.support_events (event_key, kind, org_id, summary) values ('t:1', 'conversation', o1, 'Asked about dates');
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.support_events;
  reset role;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | client read support events'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.support_events;
  reset role;
  if v_int = 1 then passed := passed + 1; else failed := failed + 1; log := log || ' | admin read ' || v_int; end if;

  -- 20. Clients can't read or write conversations or usage directly
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform 1 from public.support_conversations; failed := failed + 1; log := log || ' | client read conversations';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin insert into public.support_usage (user_id, day, messages) values (u_owner, current_date + 1, 0); failed := failed + 1; log := log || ' | client wrote usage';
  exception when insufficient_privilege then passed := passed + 1; end;
  reset role;

  raise exception 'RESULTS: % passed, % failed%', passed, failed, log;
end $$;
