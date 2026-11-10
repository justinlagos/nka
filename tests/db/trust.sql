-- Checks for migration 0004: named lead, free resizes, pause, plan auto-start, payouts, my_invites.
-- One transaction that always rolls back. Expect "RESULTS: N passed, 0 failed".
do $$
declare
  u_owner    uuid := 'b0000000-0000-4000-8000-000000000001';
  u_viewer   uuid := 'b0000000-0000-4000-8000-000000000002';
  u_staff    uuid := 'b0000000-0000-4000-8000-000000000003';
  u_staff2   uuid := 'b0000000-0000-4000-8000-000000000004';
  u_outsider uuid := 'b0000000-0000-4000-8000-000000000005';
  v_org uuid; pa uuid; pb uuid; pc uuid; pr uuid; d1 uuid; t_viewer uuid;
  v_text text; v_int int; v_uuid uuid;
  passed int := 0; failed int := 0; log text := '';
begin
  insert into public.staff_emails values ('s1@trust.test'), ('s2@trust.test') on conflict do nothing;
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.email,
         jsonb_build_object('full_name', x.name), '{}'::jsonb, now(), now()
  from (values (u_owner, 'owner@trust.test', 'Ada Owner'), (u_viewer, 'viewer@trust.test', 'Chi Viewer'),
               (u_staff, 's1@trust.test', 'Lead One'), (u_staff2, 's2@trust.test', 'Lead Two'),
               (u_outsider, 'out@trust.test', 'Dee Outsider')) as x(id, email, name);

  -- Owner sets up, invites a viewer and the outsider
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_org := public.create_org('Trust Co', 'United Kingdom');
  insert into public.invites (org_id, email, role, invited_by) values (v_org, 'viewer@trust.test', 'viewer', u_owner);
  insert into public.invites (org_id, email, role, invited_by) values (v_org, 'out@trust.test', 'member', u_owner);
  select token into t_viewer from public.invites where org_id = v_org and email = 'viewer@trust.test';
  begin
    perform public.staff_set_lead(v_org, u_staff, '');
    failed := failed + 1; log := log || ' | client set a lead';
  exception when others then passed := passed + 1; end;
  reset role;

  -- 1. my_invites shows pending invites for the signed-in email only
  perform set_config('request.jwt.claims', json_build_object('sub', u_outsider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.my_invites();
  if v_int = 1 then passed := passed + 1; else failed := failed + 1; log := log || ' | outsider invites ' || v_int; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_viewer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(t_viewer);
  select count(*) into v_int from public.my_invites();
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | accepted invite still listed'; end if;
  reset role;

  -- 2. Staff names a lead. Since 0012 a new client already has one (least busy designer, else the admin),
  --    so this is a change and needs a handover note.
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.staff_set_lead(v_org, u_staff, 'Lead One takes over from the automatic choice.');
  perform public.staff_set_plan(v_org, 'starter', 'active', 1, 'gbp', 2);
  reset role;
  select lead_id into v_uuid from public.orgs where id = v_org;
  if v_uuid = u_staff then passed := passed + 1; else failed := failed + 1; log := log || ' | lead not set'; end if;

  -- 3. A sent brief goes to the lead
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.projects (org_id, title, brief, created_by) values (v_org, 'Brief A', '{"summary":"A poster"}', u_owner)
    returning id into pa;
  v_text := public.submit_project(pa);
  select assignee into v_uuid from public.projects where id = pa;
  if v_text = 'submitted' and v_uuid = u_staff then passed := passed + 1;
  else failed := failed + 1; log := log || ' | brief A ' || v_text || ' assignee ' || coalesce(v_uuid::text, 'none'); end if;
  reset role;

  -- 4. Plan client starts straight away; file reviewed; project completed
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_text := public.staff_send_estimate(pa, 0, 6, current_date + 3, 'Poster');
  if v_text = 'in_progress' then passed := passed + 1; else failed := failed + 1; log := log || ' | A not started: ' || v_text; end if;
  begin
    perform public.staff_send_estimate(pa, 999, 6, current_date + 3, 'More');
    failed := failed + 1; log := log || ' | price changed after start';
  exception when others then passed := passed + 1; end;
  d1 := public.staff_add_deliverable(pa, 'Poster', v_org::text || '/deliverables/a.png', 'a.png', 'image/png', 10, '');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.request_resize(d1, 'Instagram story');
    failed := failed + 1; log := log || ' | resize of unapproved file';
  exception when others then passed := passed + 1; end;
  perform public.decide_deliverable(d1, 'approved', '');
  perform public.complete_project(pa);
  reset role;

  -- 5. Viewer can't ask for a resize; owner can, it starts at once, is free, and doesn't use the slot
  perform set_config('request.jwt.claims', json_build_object('sub', u_viewer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.request_resize(d1, 'Story');
    failed := failed + 1; log := log || ' | viewer asked for resize';
  exception when others then passed := passed + 1; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  pr := public.request_resize(d1, 'Instagram story 1080x1920' || chr(10) || 'LinkedIn 1200x627');
  select status || '/' || kind || '/' || coalesce(estimate_amount, -1)::text || '/' || coalesce(assignee::text, 'none')
    into v_text from public.projects where id = pr;
  if v_text = 'in_progress/resize/0.00/' || u_staff::text then passed := passed + 1;
  else failed := failed + 1; log := log || ' | resize row ' || v_text; end if;
  insert into public.projects (org_id, title, brief, created_by) values (v_org, 'Brief B', '{"summary":"A deck"}', u_owner)
    returning id into pb;
  v_text := public.submit_project(pb);
  if v_text = 'submitted' then passed := passed + 1; else failed := failed + 1; log := log || ' | resize used the slot: ' || v_text; end if;
  reset role;

  -- 6. Changing the lead needs a note, then open work moves with it
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.staff_set_lead(v_org, u_staff2, '  ');
    failed := failed + 1; log := log || ' | lead changed without a note';
  exception when others then
    if sqlerrm like 'Write a handover note%' then passed := passed + 1;
    else failed := failed + 1; log := log || ' | lead wrong error: ' || sqlerrm; end if;
  end;
  perform public.staff_set_lead(v_org, u_staff2, 'Lead One is on leave until March. Lead Two has read your brand book.');
  reset role;
  select count(*) into v_int from public.projects where id in (pb, pr) and assignee = u_staff2;
  if v_int = 2 then passed := passed + 1; else failed := failed + 1; log := log || ' | open work moved ' || v_int; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u_viewer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.lead_changes where org_id = v_org and note like 'Lead One is on leave%';
  if v_int = 1 then passed := passed + 1; else failed := failed + 1; log := log || ' | client cannot read handover'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_outsider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.lead_changes;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | outsider reads handovers'; end if;
  reset role;

  -- 7. Paused plans queue new briefs; a lapsed plan doesn't auto-start
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.staff_set_status(pb, 'completed');
  perform public.staff_set_plan(v_org, 'starter', 'paused', 1, 'gbp', 2);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.projects (org_id, title, brief, created_by) values (v_org, 'Brief C', '{"summary":"Social set"}', u_owner)
    returning id into pc;
  v_text := public.submit_project(pc);
  if v_text = 'queued' then passed := passed + 1; else failed := failed + 1; log := log || ' | paused plan started work: ' || v_text; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.staff_set_plan(v_org, 'starter', 'canceled', 1, 'gbp', 2);
  reset role;
  select status into v_text from public.projects where id = pc;
  if v_text = 'submitted' then passed := passed + 1; else failed := failed + 1; log := log || ' | C after resume ' || v_text; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_text := public.staff_send_estimate(pc, 400, 4, current_date + 2, '');
  if v_text = 'awaiting_approval' then passed := passed + 1; else failed := failed + 1; log := log || ' | lapsed plan auto-started'; end if;

  -- 8. Payouts must be negative
  begin
    perform public.staff_ledger_entry(v_org, 'payout', 100, 'Refund', null, current_date);
    failed := failed + 1; log := log || ' | positive payout';
  exception when others then passed := passed + 1; end;
  perform public.staff_ledger_entry(v_org, 'payout', -100, 'Unused budget refunded', null, current_date);
  passed := passed + 1;
  reset role;

  raise exception 'RESULTS: % passed, % failed%', passed, failed, log;
end $$;
