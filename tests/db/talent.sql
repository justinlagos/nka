-- Checks for migration 0012: designers see only their clients, names and contact details stay private,
-- designers never price, least-busy assignment, contact details blocked.
-- One transaction that always rolls back. Expect "RESULTS: N passed, 0 failed".
do $$
declare
  u_admin  uuid := 'c0000000-0000-4000-8000-000000000001';
  u_d1     uuid := 'c0000000-0000-4000-8000-000000000002';
  u_d2     uuid := 'c0000000-0000-4000-8000-000000000003';
  u_c1     uuid := 'c0000000-0000-4000-8000-000000000004';
  u_c2     uuid := 'c0000000-0000-4000-8000-000000000005';
  o1 uuid; o2 uuid; p1 uuid; p2 uuid; d1 uuid; v_partner uuid;
  v_text text; v_int int; v_uuid uuid; v_num numeric;
  passed int := 0; failed int := 0; log text := '';
begin
  -- Contact detection: what counts and what doesn't
  if public.has_contact('call me on 0803 123 4567') then passed := passed + 1; else failed := failed + 1; log := log || ' | missed local phone'; end if;
  if public.has_contact('+234 803 123 4567') then passed := passed + 1; else failed := failed + 1; log := log || ' | missed intl phone'; end if;
  if public.has_contact('ada@studio.com') then passed := passed + 1; else failed := failed + 1; log := log || ' | missed email'; end if;
  if public.has_contact('ada at gmail') then passed := passed + 1; else failed := failed + 1; log := log || ' | missed spelled email'; end if;
  if public.has_contact('message me on wa.me/2348031234567') then passed := passed + 1; else failed := failed + 1; log := log || ' | missed whatsapp'; end if;
  if public.has_contact('find me @ada_designs') then passed := passed + 1; else failed := failed + 1; log := log || ' | missed handle'; end if;
  if not public.has_contact('Sizes 1080 1920 1200, due 2026-11-20 10:30, budget N2,500,000') then passed := passed + 1; else failed := failed + 1; log := log || ' | sizes or dates flagged'; end if;
  if not public.has_contact('Prototype: figma.com/file/abc123 and our site withinafrica.co') then passed := passed + 1; else failed := failed + 1; log := log || ' | figma or website flagged'; end if;
  if public.mask_contact('About us. Email hello@brand.com or call 08031234567.') = 'About us. Email [removed] or call [removed].' then
    passed := passed + 1; else failed := failed + 1; log := log || ' | mask ' || public.mask_contact('About us. Email hello@brand.com or call 08031234567.'); end if;

  -- People: an admin, two designers (one paused), two clients
  insert into public.staff_emails values ('admin@talent.test') on conflict do nothing;
  insert into public.partners (name) values ('Test Partner') returning id into v_partner;
  insert into public.talent_emails (email, alias, partner_id) values ('d1@talent.test', 'Tobi', v_partner), ('d2@talent.test', 'Kemi', null);
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.email,
         jsonb_build_object('full_name', x.name), '{}'::jsonb, now(), now()
  from (values (u_admin, 'admin@talent.test', 'Admin Person'), (u_d1, 'd1@talent.test', 'Real Designer One'),
               (u_d2, 'd2@talent.test', 'Real Designer Two'), (u_c1, 'c1@talent.test', 'Ada Client'),
               (u_c2, 'c2@talent.test', 'Bo Client')) as x(id, email, name);
  if (select is_talent and alias = 'Tobi' and partner_id = v_partner from public.profiles where id = u_d1) then passed := passed + 1;
  else failed := failed + 1; log := log || ' | designer not set on sign-up'; end if;
  -- Both have passed the Nka test task.
  update public.profiles set vetting = 'passed' where id in (u_d1, u_d2);
  -- Only test designers take new clients in this transaction.
  update public.profiles set talent_active = false where is_talent and id not in (u_d1, u_d2);
  update public.profiles set talent_active = false where id = u_d2;

  -- 1. A new client gets the least busy active designer
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  o1 := public.create_org('Client One', 'Nigeria');
  insert into public.projects (org_id, title, brief, created_by) values (o1, 'Poster', '{"summary":"A poster"}', u_c1) returning id into p1;
  v_text := public.submit_project(p1);
  reset role;
  if (select lead_id from public.orgs where id = o1) = u_d1 then passed := passed + 1; else failed := failed + 1; log := log || ' | not auto-assigned'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u_c2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  o2 := public.create_org('Client Two', 'United Kingdom');
  insert into public.projects (org_id, title, brief, created_by) values (o2, 'Deck', '{"summary":"A deck"}', u_c2) returning id into p2;
  v_text := public.submit_project(p2);
  reset role;
  update public.orgs set lead_id = u_d2 where id = o2;  -- the other designer leads client two
  update public.projects set assignee = u_d2 where id = p2;

  -- 2. Designer one sees client one only
  perform set_config('request.jwt.claims', json_build_object('sub', u_d1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.projects where id in (p1, p2);
  if v_int = 1 then passed := passed + 1; else failed := failed + 1; log := log || ' | designer sees ' || v_int || ' projects'; end if;
  select count(*) into v_int from public.orgs where id = o2;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | designer sees other client'; end if;

  -- 3. Designer never sees client emails; gets a first name only
  select count(*) into v_int from public.profiles where id = u_c1;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | designer reads client profile'; end if;
  select name into v_text from public.display_names(array[u_c1, u_c2]) where id = u_c1;
  if v_text = 'Ada' then passed := passed + 1; else failed := failed + 1; log := log || ' | designer sees client as ' || coalesce(v_text, 'null'); end if;
  select count(*) into v_int from public.display_names(array[u_c2]);
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | designer sees other client name'; end if;

  -- 4. Designer proposes a date for a client not on a plan: no price, status unchanged
  v_text := public.staff_send_estimate(p1, 999, 6, current_date + 3, 'Two options');
  select estimate_amount into v_num from public.projects where id = p1;
  if v_text = 'proposed' and v_num is null and (select status from public.projects where id = p1) = 'submitted' then passed := passed + 1;
  else failed := failed + 1; log := log || ' | proposal ' || v_text || ' amount ' || coalesce(v_num::text, 'null'); end if;

  -- 5. Designer can't touch the other client, set leads or plans, or cancel
  begin perform public.staff_send_estimate(p2, 0, 2, current_date + 2, ''); failed := failed + 1; log := log || ' | estimated other client';
  exception when others then passed := passed + 1; end;
  begin perform public.staff_set_lead(o1, u_d1, ''); failed := failed + 1; log := log || ' | designer set lead';
  exception when others then passed := passed + 1; end;
  begin perform public.staff_set_plan(o1, 'growth', 'active', 3, 'gbp', 2); failed := failed + 1; log := log || ' | designer set plan';
  exception when others then passed := passed + 1; end;
  begin perform public.staff_set_status(p1, 'cancelled'); failed := failed + 1; log := log || ' | designer cancelled';
  exception when others then passed := passed + 1; end;

  -- 6. Contact details in a message are refused; an ordinary message goes through
  begin
    insert into public.comments (project_id, org_id, author, body) values (p1, o1, u_d1, 'WhatsApp me on 08031234567');
    failed := failed + 1; log := log || ' | phone posted';
  exception when others then passed := passed + 1; end;
  insert into public.comments (project_id, org_id, author, body) values (p1, o1, u_d1, 'Question: should the poster be A2 or A3?');
  passed := passed + 1;
  reset role;

  -- 7. On a paid-up plan the designer confirms and it starts, at no extra charge
  update public.orgs set plan = 'growth', plan_status = 'active', active_limit = 3 where id = o1;
  update public.projects set status = 'submitted', estimate_hours = null, estimate_due = null where id = p1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_d1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_text := public.staff_send_estimate(p1, 999, 6, current_date + 3, '');
  select estimate_amount into v_num from public.projects where id = p1;
  if v_text = 'in_progress' and v_num = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | plan start ' || v_text || ' ' || coalesce(v_num::text, 'null'); end if;
  d1 := public.staff_add_deliverable(p1, 'Poster', o1::text || '/' || p1::text || '/a.png', 'a.png', 'image/png', 10, 'First draft');
  passed := passed + 1;
  -- 8. Designer can't approve their own file
  begin perform public.decide_deliverable(d1, 'approved', ''); failed := failed + 1; log := log || ' | designer approved own file';
  exception when others then passed := passed + 1; end;
  reset role;
  -- 8b. The client can't see it until Nka passes it; the maker can't pass their own work
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.deliverables where id = d1;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | client saw a version in Nka review'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_d1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.review_deliverable(d1, 'release', '', 5); failed := failed + 1; log := log || ' | maker passed own work';
  exception when others then passed := passed + 1; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_text := public.review_deliverable(d1, 'release', '', 5);
  if v_text = 'released' then passed := passed + 1; else failed := failed + 1; log := log || ' | admin review gave ' || v_text; end if;
  reset role;

  -- 9. The client sees the designer's alias, never their name or email
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.profiles where id = u_d1;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | client reads designer profile'; end if;
  select name into v_text from public.display_names(array[u_d1]);
  if v_text = 'Tobi' then passed := passed + 1; else failed := failed + 1; log := log || ' | client sees designer as ' || coalesce(v_text, 'null'); end if;
  begin
    insert into public.comments (project_id, org_id, author, body) values (p1, o1, u_c1, 'Email me at ada@client.com');
    failed := failed + 1; log := log || ' | client email posted';
  exception when others then passed := passed + 1; end;
  perform public.decide_deliverable(d1, 'approved', 'Lovely');
  passed := passed + 1;
  reset role;

  -- 10. Admin sees real names and can price a proposal
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select name into v_text from public.display_names(array[u_d1]);
  if v_text = 'Real Designer One' then passed := passed + 1; else failed := failed + 1; log := log || ' | admin sees ' || coalesce(v_text, 'null'); end if;
  select count(*) into v_int from public.partners;
  if v_int >= 1 then passed := passed + 1; else failed := failed + 1; log := log || ' | admin cannot see partners'; end if;
  reset role;

  -- 11. Clients and designers can't read partners
  perform set_config('request.jwt.claims', json_build_object('sub', u_d1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_int from public.partners;
  if v_int = 0 then passed := passed + 1; else failed := failed + 1; log := log || ' | designer reads partners'; end if;
  reset role;

  -- 12. A designer can't have or join a client workspace
  perform set_config('request.jwt.claims', json_build_object('sub', u_d1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.create_org('Sneaky', ''); failed := failed + 1; log := log || ' | designer made a workspace';
  exception when others then passed := passed + 1; end;
  reset role;
  insert into public.invites (org_id, email, role, invited_by) values (o2, 'd1@talent.test', 'member', u_c2);
  perform set_config('request.jwt.claims', json_build_object('sub', u_d1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.accept_invite((select token from public.invites where org_id = o2 and email = 'd1@talent.test'));
    failed := failed + 1; log := log || ' | designer joined a client';
  exception when others then passed := passed + 1; end;
  reset role;

  -- 13. A client can't be made a designer
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_add_designer('c1@talent.test', 'X', null); failed := failed + 1; log := log || ' | client made designer';
  exception when others then passed := passed + 1; end;
  reset role;

  -- 14. Sign-in codes: one every 45 seconds per address
  if public.signin_code_allowed('codes@talent.test') = 'ok' and public.signin_code_allowed('codes@talent.test') = 'wait' then
    passed := passed + 1; else failed := failed + 1; log := log || ' | code throttle'; end if;

  raise exception 'RESULTS: % passed, % failed%', passed, failed, log;
end $$;
