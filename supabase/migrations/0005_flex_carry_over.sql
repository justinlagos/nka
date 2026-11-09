-- Flex budget carries over for 12 months by default (and is paid back on request when a client leaves).
alter table public.orgs alter column rollover_months set default 12;

-- Wording: resizes cover other sizes and formats of approved work.
create or replace function public.request_resize(p_deliverable uuid, p_sizes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  d public.deliverables%rowtype;
  v_lead uuid;
  v_id uuid;
begin
  select * into d from public.deliverables where id = p_deliverable;
  if not found or not public.can_edit_org(d.org_id) then raise exception 'File not found.' using errcode = '42501'; end if;
  if d.status <> 'approved' then raise exception 'Resizes are for files you have approved.' using errcode = '22023'; end if;
  if coalesce(trim(p_sizes), '') = '' then raise exception 'List the sizes or formats you need.' using errcode = '22023'; end if;
  if char_length(p_sizes) > 2000 then raise exception 'Keep the list under 2,000 characters.' using errcode = '22023'; end if;
  select lead_id into v_lead from public.orgs where id = d.org_id;
  insert into public.projects (
    org_id, title, service, kind, source_deliverable, status, brief, submitted_at, approved_at, approved_by,
    estimate_amount, estimate_notes, estimate_sent_at, assignee, created_by)
  values (
    d.org_id, left('Resize: ' || d.title, 200), 'resizes', 'resize', d.id, 'in_progress',
    jsonb_build_object(
      'summary', 'Other sizes or formats of "' || d.title || '" (version ' || d.version || ').',
      'deliverables', trim(p_sizes)),
    now(), now(), auth.uid(),
    0, 'Free. Other sizes and formats of work we made for you are included.', now(), v_lead, auth.uid())
  returning id into v_id;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v_id, d.org_id, auth.uid(), 'resize_requested', jsonb_build_object('from', d.title, 'version', d.version));
  return v_id;
end $$;
revoke execute on function public.request_resize(uuid, text) from public, anon;
grant execute on function public.request_resize(uuid, text) to authenticated;
