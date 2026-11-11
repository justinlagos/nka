-- Checks for migration 0014: team plans and hours, Nka review, roles, client teams and the test task.
-- One transaction that always rolls back. Expect "RESULTS: N passed, 0 failed".
do $$
declare
  u_admin uuid := 'e0000000-0000-4000-8000-000000000001';
  u_d1    uuid := 'e0000000-0000-4000-8000-000000000002';  -- designer, agency A
  u_la    uuid := 'e0000000-0000-4000-8000-000000000003';  -- creative lead, agency A
  u_lb    uuid := 'e0000000-0000-4000-8000-000000000004';  -- creative lead, agency B
  u_new   uuid := 'e0000000-0000-4000-8000-000000000005';  -- designer on trial
  u_c1    uuid := 'e0000000-0000-4000-8000-000000000006';  -- client owner
  pa uuid; pb uuid; o1 uuid; o_test uuid; p1 uuid; p2 uuid; p3 uuid; p4 uuid; d1 uuid; d2 uuid;
  v_text text; v_int int; v_num numeric; v_json jsonb;
  passed int := 0; failed int := 0; log text := '';
begin
  insert into public.staff_emails values ('admin@plans.test') on conflict do nothing;
  insert into public.partners (name) values ('Agency A') returning id into pa;
  insert into public.partners (name) values ('Agency B') returning id into pb;
  insert into public.talent_emails (email, alias, partner_id) values
    ('d1@plans.test', 'Ada', pa), ('la@plans.test', 'Lead A', pa), ('lb@plans.test', 'Lead B', pb), ('new@plans.test', 'Newer', pa);
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.email,
         jsonb_build_object('full_name', x.name), '{}'::jsonb, now(), now()
  from (values (u_admin, 'admin@plans.test', 'Admin'), (u_d1, 'd1@plans.test', 'Designer One'),
               (u_la, 'la@plans.test', 'Lead A'), (u_lb, 'lb@plans.test', 'Lead B'),
               (u_new, 'new@plans.test', 'New Person'), (u_c1, 'c1@plans.test', 'Client One')) as x(id, email, name);
  update public.profiles set talent_active = false where is_talent and id not in (u_d1, u_la, u_lb, u_new);

  -- 1. New people start on trial
  if (select vetting from public.profiles where id = u_new) = 'trial' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | new person not on trial'; end if;

  -- 2. Admin sets roles and passes the test task
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_set_talent(u_d1, 'designer', 'passed', 'Test task: strong');
  perform public.admin_set_talent(u_la, 'creative_lead', 'passed', '');
  perform public.admin_set_talent(u_lb, 'creative_lead', 'passed', '');
  reset role;
  if (select vetting = 'passed' and vetted_at is not null from public.profiles where id = u_d1) then passed := passed + 1;
  else failed := failed + 1; log := log || ' | vetting not saved'; end if;

  -- 3. A new client gets a designer who has passed, never one on trial
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  o1 := public.create_org('Plan Client', 'Nigeria');
  insert into public.projects (org_id, title, brief, created_by) values (o1, 'Launch posts', '{"summary":"Six posts"}', u_c1) returning id into p1;
  perform public.submit_project(p1);
  reset role;
  if (select lead_id from public.orgs where id = o1) = u_d1 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | lead was ' || coalesce((select lead_id::text from public.orgs where id = o1), 'null'); end if;

  -- 4. Someone on trial can't lead a client, but can work on an internal test workspace
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.staff_set_lead(o1, u_new, 'Swap'); failed := failed + 1; log := log || ' | trial person made lead';
  exception when others then passed := passed + 1; end;
  o_test := public.create_org('Nka test tasks', 'United Kingdom');
  perform public.admin_set_internal(o_test, true);
  perform public.staff_set_lead(o_test, u_new, '');
  passed := passed + 1;
  -- 5. Team roles must match the person
  begin perform public.admin_set_team(o1, 'creative_lead', u_d1); failed := failed + 1; log := log || ' | designer set as creative lead';
  exception when others then passed := passed + 1; end;
  perform public.admin_set_team(o1, 'creative_lead', u_la);
  reset role;

  -- 6. Not on a plan: the brief isn't started
  v_text := public.system_start_brief(p1, 6, current_date + 2, '');
  if v_text = 'not_on_plan' then passed := passed + 1; else failed := failed + 1; log := log || ' | no plan gave ' || v_text; end if;

  -- 7. Starter: 8 hours a month; a 6-hour brief starts and uses 6
  update public.orgs set plan = 'starter', plan_status = 'active', active_limit = 1 where id = o1;
  v_json := public.hours_balance(o1);
  if (v_json->>'allowance')::numeric = 8 and (v_json->>'left')::numeric = 8 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | starter balance ' || v_json::text; end if;
  v_text := public.system_start_brief(p1, 6, current_date + 2, 'Six posts');
  if v_text = 'started' and public.hours_left(o1) = 2 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | start gave ' || v_text || ', left ' || public.hours_left(o1); end if;

  -- 8. The next 6-hour brief waits for hours
  insert into public.projects (org_id, title, brief, created_by, status, submitted_at)
    values (o1, 'Deck', '{"summary":"Pitch deck"}', u_c1, 'submitted', now()) returning id into p2;
  v_text := public.system_start_brief(p2, 6, current_date + 2, '');
  if v_text = 'needs_hours' and (select count(*) from public.system_waiting_briefs(o1)) = 1 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | short gave ' || v_text; end if;

  -- 9. A paid top-up (once per payment) lets it start
  if public.system_top_up(o1, 5, 'cs_test_plans_1') and not public.system_top_up(o1, 5, 'cs_test_plans_1') then passed := passed + 1;
  else failed := failed + 1; log := log || ' | top-up counted twice'; end if;
  v_text := public.system_start_brief(p2, 6, current_date + 2, '');
  if v_text = 'started' and public.hours_left(o1) = 1 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | after top-up ' || v_text || ', left ' || public.hours_left(o1); end if;

  -- 10. A designer can't start more than the hours left; the admin can
  insert into public.projects (org_id, title, brief, created_by, status, submitted_at, assignee)
    values (o1, 'Report', '{"summary":"Annual report"}', u_c1, 'submitted', now(), u_d1) returning id into p3;
  perform set_config('request.jwt.claims', json_build_object('sub', u_d1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.staff_send_estimate(p3, 0, 14, current_date + 4, ''); failed := failed + 1; log := log || ' | designer overspent';
  exception when others then passed := passed + 1; end;
  reset role;

  -- 11. Cancelled before the client saw anything: hours come back
  update public.projects set status = 'cancelled' where id = p2;
  if public.hours_left(o1) = 7 then passed := passed + 1; else failed := failed + 1; log := log || ' | after cancel left ' || public.hours_left(o1); end if;

  -- 12. Last month's leftover carries over once; the month before that lapses
  update public.hours_ledger set month = (public.hours_month() - interval '1 month')::date where org_id = o1;
  delete from public.hours_ledger where org_id = o1 and kind = 'allowance' and month = public.hours_month();
  v_json := public.hours_balance(o1);
  if (v_json->>'carried')::numeric = 7 and (v_json->>'left')::numeric = 15 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | carry ' || v_json::text; end if;
  update public.hours_ledger set month = (public.hours_month() - interval '2 months')::date where org_id = o1 and month < public.hours_month();
  v_json := public.hours_balance(o1);
  if (v_json->>'carried')::numeric = 0 and (v_json->>'left')::numeric = 8 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | lapse ' || v_json::text; end if;

  -- 13. A maker's version waits for Nka review; the client can't see it, or the internal event
  perform set_config('request.jwt.claims', json_build_object('sub', u_d1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  d1 := public.staff_add_deliverable(p1, 'Posts', o1::text || '/' || p1::text || '/posts.png', 'posts.png', 'image/png', 10, '');
  reset role;
  if (select status from public.deliverables where id = d1) = 'internal_review' and (select status from public.projects where id = p1) = 'in_progress'
  then passed := passed + 1; else failed := failed + 1; log := log || ' | upload went straight out'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.deliverables where project_id = p1;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | client sees unreviewed version'; end if;
  select count(*) into v_int from public.project_events where project_id = p1 and kind like 'internal%';
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | client sees internal event'; end if;
  reset role;

  -- 14. A creative lead from the maker's own agency can't pass it
  perform set_config('request.jwt.claims', json_build_object('sub', u_la, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.review_deliverable(d1, 'release', '', 5); failed := failed + 1; log := log || ' | same agency passed it';
  exception when others then passed := passed + 1; end;
  reset role;

  -- 15. The client's creative lead from another agency sends it back with a note; the client still sees nothing
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_set_team(o1, 'creative_lead', u_lb);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_lb, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.review_deliverable(d1, 'return', '  ', 5); failed := failed + 1; log := log || ' | returned without a note';
  exception when others then passed := passed + 1; end;
  v_text := public.review_deliverable(d1, 'return', 'Type is generic. Use the brand serif.', 10);
  reset role;
  if v_text = 'returned' then passed := passed + 1; else failed := failed + 1; log := log || ' | return gave ' || v_text; end if;

  -- 16. The fixed version passes; the client sees it; a late first draft gives the hours back
  update public.projects set estimate_due = current_date - 1 where id = p1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_d1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  d2 := public.staff_add_deliverable(p1, 'Posts', o1::text || '/' || p1::text || '/posts-2.png', 'posts-2.png', 'image/png', 10, 'Brand serif');
  reset role;
  v_num := public.hours_left(o1);
  perform set_config('request.jwt.claims', json_build_object('sub', u_lb, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_text := public.review_deliverable(d2, 'release', '', 6);
  reset role;
  if v_text = 'released' and (select status from public.projects where id = p1) = 'in_review' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | release gave ' || v_text; end if;
  if public.hours_left(o1) = v_num + 6 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | late hours not returned: ' || v_num || ' to ' || public.hours_left(o1); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.deliverables where project_id = p1;
  if v_int = 1 then passed := passed + 1; else failed := failed + 1; log := log || ' | client sees ' || v_int || ' versions'; end if;
  perform public.decide_deliverable(d2, 'approved', '');
  passed := passed + 1;
  reset role;

  -- 17. Instant plan: 10 Instant briefs, 1 team hour, one request at a time
  update public.orgs set plan = 'instant', plan_status = 'active', active_limit = 1 where id = o1;
  if public.instant_limit(o1) = 10 and public.effective_limit(o1) = 1 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | instant limits ' || public.instant_limit(o1) || '/' || public.effective_limit(o1); end if;
  delete from public.hours_ledger where org_id = o1;
  if (public.hours_balance(o1)->>'allowance')::numeric = 1 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | instant allowance ' || (public.hours_balance(o1)->>'allowance'); end if;

  -- 18. Upgrading mid-month tops the allowance up to the new plan
  update public.orgs set plan = 'growth', active_limit = 2 where id = o1;
  if (public.hours_balance(o1)->>'allowance')::numeric = 20 then passed := passed + 1;
  else failed := failed + 1; log := log || ' | upgrade allowance ' || (public.hours_balance(o1)->>'allowance'); end if;

  -- 19. Flex is gone
  begin update public.orgs set plan = 'flex' where id = o1; failed := failed + 1; log := log || ' | flex accepted';
  exception when others then passed := passed + 1; end;

  -- 20. A client can't read another client's hours or add hours
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.hours_balance(o_test); failed := failed + 1; log := log || ' | read another client''s hours';
  exception when others then passed := passed + 1; end;
  begin perform public.staff_adjust_hours(o1, 50, 'free'); failed := failed + 1; log := log || ' | client added hours';
  exception when others then passed := passed + 1; end;
  reset role;

  raise exception 'RESULTS: % passed, % failed%', passed, failed, log;
end $$;
