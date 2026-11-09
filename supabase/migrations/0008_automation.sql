-- 0008: automation. Brand read from a website, briefs sized the moment they're sent,
-- paid plans started automatically, AI concept images, and reminder bookkeeping.

-- Brand book fields filled from the client's website.
alter table public.brand_books add column website text not null default '' check (char_length(website) <= 300);
alter table public.brand_books add column logo_path text;
alter table public.brand_books add column palette jsonb not null default '[]'::jsonb check (jsonb_typeof(palette) = 'array');
alter table public.brand_books add column fonts jsonb not null default '[]'::jsonb check (jsonb_typeof(fonts) = 'array');
alter table public.brand_books add column scanned_at timestamptz;
grant update (website, logo_path, palette, fonts, scanned_at) on public.brand_books to authenticated;

-- Nka's own sizing of a brief: shown to the client as an expected date, and pre-filled for the studio.
alter table public.projects add column suggested_hours numeric(7, 1);
alter table public.projects add column suggested_days int;
alter table public.projects add column suggested_due date;
alter table public.projects add column suggested_amount numeric(12, 2);
alter table public.projects add column suggested_notes text not null default '';
alter table public.projects add column sized_at timestamptz;
alter table public.projects add column concepts_status text not null default 'none'
  check (concepts_status in ('none', 'pending', 'ready', 'failed'));
alter table public.projects add column last_nudged_at timestamptz;

-- AI concept images sit alongside references and brand files.
alter table public.attachments drop constraint attachments_kind_check;
alter table public.attachments add constraint attachments_kind_check check (kind in ('reference', 'brand', 'concept'));

-- Starts a paid-up plan client's brief with the date Nka worked out. Server only.
create or replace function public.system_autostart(p_project uuid, p_hours numeric, p_due date, p_notes text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
  o public.orgs%rowtype;
begin
  select * into v from public.projects where id = p_project for update;
  if not found or v.status <> 'submitted' or v.kind <> 'brief' then return false; end if;
  select * into o from public.orgs where id = v.org_id;
  if not (o.plan in ('starter', 'growth', 'studio') and o.plan_status in ('active', 'trialing')) then return false; end if;
  update public.projects set
    estimate_amount = 0, estimate_hours = p_hours, estimate_due = p_due,
    estimate_notes = coalesce(p_notes, ''), estimate_sent_at = now(),
    status = 'in_progress', approved_at = now(),
    assignee = coalesce(assignee, o.lead_id)
  where id = p_project;
  insert into public.project_events (project_id, org_id, actor, kind, detail)
    values (v.id, v.org_id, null, 'auto_started', jsonb_build_object('due', p_due, 'hours', p_hours));
  return true;
end $$;
revoke execute on function public.system_autostart(uuid, numeric, date, text) from public, anon, authenticated;
grant execute on function public.system_autostart(uuid, numeric, date, text) to service_role;
