-- Nka database workflow test. Runs as one transaction and always rolls back:
-- the final RAISE carries the results and undoes every row it made.
-- Run with the Supabase SQL editor or execute_sql. Expect "RESULTS: N passed, 0 failed".
do $$
declare
  u_owner    uuid := 'a0000000-0000-4000-8000-000000000001';
  u_member   uuid := 'a0000000-0000-4000-8000-000000000002';
  u_viewer   uuid := 'a0000000-0000-4000-8000-000000000003';
  u_staff    uuid := 'a0000000-0000-4000-8000-000000000004';
  u_outsider uuid := 'a0000000-0000-4000-8000-000000000005';
  v_org uuid; p1 uuid; p2 uuid; p3 uuid; d1 uuid; d2 uuid;
  t_member uuid; t_viewer uuid;
  v_text text; v_int int; v_num numeric; v_bool boolean;
  passed int := 0; failed int := 0; log text := '';
begin
  -- Seed people. Staff is recognised by the staff_emails list.
  insert into public.staff_emails values ('staff@nka.test') on conflict do nothing;
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.email,
         jsonb_build_object('full_name', x.name), '{}'::jsonb, now(), now()
  from (values (u_owner, 'owner@nka.test', 'Ada Owner'), (u_member, 'member@nka.test', 'Bayo Member'),
               (u_viewer, 'viewer@nka.test', 'Chi Viewer'), (u_staff, 'staff@nka.test', 'Studio Staff'),
               (u_outsider, 'outsider@nka.test', 'Dee Outsider')) as x(id, email, name);

  select is_staff into v_bool from public.profiles where id = u_staff;
  if v_bool then passed := passed + 1; else failed := failed + 1; log := log || ' | staff flag not set'; end if;

  -- 1. Owner creates the org
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_org := public.create_org('Test Co', 'United Kingdom');
  select count(*) into v_int from public.org_members where org_id = v_org and user_id = u_owner and role = 'owner';
  if v_int = 1 then passed := passed + 1; else failed := failed + 1; log := log || ' | owner not added'; end if;

  -- 2. Owner invites a member and a viewer
  insert into public.invites (org_id, email, role, invited_by) values (v_org, 'member@nka.test', 'member', u_owner);
  insert into public.invites (org_id, email, role, invited_by) values (v_org, 'viewer@nka.test', 'viewer', u_owner);
  select token into t_member from public.invites where org_id = v_org and email = 'member@nka.test';
  select token into t_viewer from public.invites where org_id = v_org and email = 'viewer@nka.test';
  reset role;

  -- 3. Outsider can't take someone else's invite
  perform set_config('request.jwt.claims', json_build_object('sub', u_outsider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.accept_invite(t_viewer);
    failed := failed + 1; log := log || ' | outsider accepted viewer invite';
  exception when others then
    if sqlerrm like 'This invite was sent to%' then passed := passed + 1;
    else failed := failed + 1; log := log || ' | invite wrong error: ' || sqlerrm; end if;
  end;
  select count(*) into v_int from public.orgs;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | outsider sees orgs'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(t_member);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_viewer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(t_viewer);
  -- 4. Viewer can't create a brief
  begin
    insert into public.projects (org_id, title, brief, created_by)
      values (v_org, 'Viewer brief', '{"summary":"x"}', u_viewer);
    failed := failed + 1; log := log || ' | viewer created brief';
  exception when others then passed := passed + 1;
  end;
  -- Viewer can't comment
  reset role;

  -- 5. Member drafts and sends a brief (no plan: goes to submitted)
  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.projects (org_id, title, service, brief, created_by)
    values (v_org, 'Annual report', 'reports', '{"summary":"A 24 page annual report"}', u_member)
    returning id into p1;
  v_text := public.submit_project(p1);
  if v_text = 'submitted' then passed := passed + 1; else failed := failed + 1; log := log || ' | submit gave ' || v_text; end if;
  -- Member can't edit a sent brief
  update public.projects set title = 'Changed' where id = p1;
  get diagnostics v_int = row_count;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | edited a sent brief'; end if;
  -- Member can't touch the plan or status
  begin
    update public.orgs set plan = 'studio' where id = v_org;
    failed := failed + 1; log := log || ' | member changed plan';
  exception when others then passed := passed + 1;
  end;
  begin
    update public.projects set status = 'completed' where id = p1;
    failed := failed + 1; log := log || ' | member set status';
  exception when others then passed := passed + 1;
  end;
  -- Staff functions refuse clients
  begin
    perform public.staff_send_estimate(p1, 100, 1, current_date, '');
    failed := failed + 1; log := log || ' | client sent estimate';
  exception when others then
    if sqlerrm in ('Studio staff only.', 'Only this client''s designer or the Nka admin can do that.') then passed := passed + 1;
    else failed := failed + 1; log := log || ' | staff check wrong error: ' || sqlerrm; end if;
  end;
  reset role;

  -- 6. Viewer can't comment; member can, with a pin
  perform set_config('request.jwt.claims', json_build_object('sub', u_viewer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.comments (project_id, org_id, author, body) values (p1, v_org, u_viewer, 'hi');
    failed := failed + 1; log := log || ' | viewer commented';
  exception when others then passed := passed + 1;
  end;
  reset role;

  -- 7. Staff sends an estimate; no plan means the client must approve
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_text := public.staff_send_estimate(p1, 1200, 16, current_date + 7, 'Two rounds of changes included');
  if v_text = 'awaiting_approval' then passed := passed + 1; else failed := failed + 1; log := log || ' | estimate gave ' || v_text; end if;
  select count(*) into v_int from public.orgs;
  if v_int >= 1 then passed := passed + 1; else failed := failed + 1; log := log || ' | staff cannot see orgs'; end if;
  reset role;

  -- 8. Member can't approve; owner can
  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.approve_estimate(p1);
    failed := failed + 1; log := log || ' | member approved';
  exception when others then passed := passed + 1;
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.approve_estimate(p1);
  select status into v_text from public.projects where id = p1;
  if v_text = 'in_progress' then passed := passed + 1; else failed := failed + 1; log := log || ' | after approve: ' || v_text; end if;
  reset role;

  -- 9. Flex: staff allocates budget; an approved estimate draws it down
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.staff_set_plan(v_org, 'flex', 'active', null, 'gbp', 2);
  perform public.staff_ledger_entry(v_org, 'allocation', 5000, 'November budget');
  begin
    perform public.staff_ledger_entry(v_org, 'spend', 50, 'wrong sign');
    failed := failed + 1; log := log || ' | positive spend accepted';
  exception when others then passed := passed + 1;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.projects (org_id, title, brief, created_by)
    values (v_org, 'Event poster', '{"summary":"A2 poster"}', u_member) returning id into p2;
  perform public.submit_project(p2);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.staff_send_estimate(p2, 1500, 20, current_date + 5, '');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.approve_estimate(p2);
  select sum(amount) into v_num from public.budget_ledger where org_id = v_org;
  if v_num = 3500 then passed := passed + 1; else failed := failed + 1; log := log || ' | balance ' || coalesce(v_num::text, 'null'); end if;
  reset role;

  -- 10. Staff uploads two versions; client reviews
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  d1 := public.staff_add_deliverable(p2, 'Poster', v_org || '/' || p2 || '/poster-v1.png', 'poster-v1.png', 'image/png', 1000, '');
  d2 := public.staff_add_deliverable(p2, 'poster', v_org || '/' || p2 || '/poster-v2.png', 'poster-v2.png', 'image/png', 1000, 'Tighter headline');
  select version into v_int from public.deliverables where id = d2;
  if v_int = 2 then passed := passed + 1; else failed := failed + 1; log := log || ' | version ' || v_int; end if;
  begin
    perform public.staff_add_deliverable(p2, 'Bad', 'not-the-org/x.png', 'x.png', 'image/png', 1, '');
    failed := failed + 1; log := log || ' | wrong folder accepted';
  exception when others then passed := passed + 1;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.decide_deliverable(d1, 'changes_requested', '  ');
    failed := failed + 1; log := log || ' | change request without note';
  exception when others then passed := passed + 1;
  end;
  perform public.decide_deliverable(d1, 'changes_requested', 'Logo is too small');
  select status into v_text from public.projects where id = p2;
  if v_text = 'changes_requested' then passed := passed + 1; else failed := failed + 1; log := log || ' | after changes: ' || v_text; end if;
  insert into public.comments (project_id, org_id, deliverable_id, author, body, pin_x, pin_y)
    values (p2, v_org, d2, u_member, 'Move this up', 0.4, 0.2);
  perform public.decide_deliverable(d2, 'approved', '');
  perform public.complete_project(p2);
  select status into v_text from public.projects where id = p2;
  if v_text = 'completed' then passed := passed + 1; else failed := failed + 1; log := log || ' | after complete: ' || v_text; end if;
  select count(*) into v_int from public.project_events where project_id = p2;
  if v_int >= 5 then passed := passed + 1; else failed := failed + 1; log := log || ' | events ' || v_int; end if;
  reset role;

  -- 11. Plan cap: Starter allows one active project; the next one queues and moves up later
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.staff_set_plan(v_org, 'starter', 'active', 1, 'gbp', 2);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.projects (org_id, title, brief, created_by)
    values (v_org, 'Social pack', '{"summary":"Ten posts"}', u_member) returning id into p3;
  v_text := public.submit_project(p3);
  if v_text = 'queued' then passed := passed + 1; else failed := failed + 1; log := log || ' | cap gave ' || v_text; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.staff_set_status(p1, 'completed');
  select status into v_text from public.projects where id = p3;
  if v_text = 'submitted' then passed := passed + 1; else failed := failed + 1; log := log || ' | queue gave ' || v_text; end if;
  -- On a plan, an estimate starts work without client approval
  v_text := public.staff_send_estimate(p3, 0, 6, current_date + 3, '');
  if v_text = 'in_progress' then passed := passed + 1; else failed := failed + 1; log := log || ' | plan estimate gave ' || v_text; end if;
  reset role;

  -- 12. Leads: anyone can send, only staff can read
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  insert into public.leads (name, email, company, interest, message) values ('Lead', 'lead@nka.test', 'Lead Ltd', 'flex', 'Hello');
  select count(*) into v_int from public.leads;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | anon read leads'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.leads where email = 'lead@nka.test';
  if v_int = 1 then passed := passed + 1; else failed := failed + 1; log := log || ' | staff lead count ' || v_int; end if;
  reset role;

  -- 13. Outsider sees no work, no files, and only their own and staff profiles
  perform set_config('request.jwt.claims', json_build_object('sub', u_outsider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.projects;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | outsider sees projects'; end if;
  select count(*) into v_int from public.deliverables;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | outsider sees files'; end if;
  select count(*) into v_int from public.profiles where id in (u_owner, u_member, u_viewer);
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | outsider sees client profiles'; end if;
  if not public.can_view_org(v_org) and not public.can_edit_org(v_org) then passed := passed + 1;
  else failed := failed + 1; log := log || ' | outsider has storage access'; end if;
  reset role;

  -- 14. Owner can't be removed by an admin path; member can't remove anyone
  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.org_members where org_id = v_org and user_id = u_viewer;
  get diagnostics v_int = row_count;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | member removed someone'; end if;
  reset role;

  raise exception 'RESULTS: % passed, % failed%', passed, failed, log;
end $$;
