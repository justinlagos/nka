-- 0015: the Nka API. The same studio, with a door for other software: agents and platforms send a
-- request with an API key and get finished files back.
--
--   api_accounts   one per organisation: whether the API is on, and its monthly credit cap
--   api_keys       secret keys, stored as SHA-256 hashes; the full key is shown once, at creation
--   api_jobs       every request, its input, its result and what it cost in credits
--   ecards         a card made through the API; ecard_recipients holds one personal link each
--
-- The browser can read its own organisation's keys (never the hash or the webhook secret) and jobs.
-- Every write goes through a function below. Requests from API callers arrive with the service role
-- (the server checks the key first), so those functions are granted to service_role only.

create table public.api_accounts (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  enabled boolean not null default false,
  monthly_credits int not null default 200 check (monthly_credits between 0 and 1000000),
  per_minute int not null default 30 check (per_minute between 1 and 600),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  prefix text not null check (char_length(prefix) between 8 and 24),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  webhook_secret text not null check (char_length(webhook_secret) >= 32),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_org_idx on public.api_keys(org_id);

create table public.api_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  key_id uuid references public.api_keys(id) on delete set null,
  endpoint text not null check (char_length(endpoint) between 1 and 60),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  units int not null default 0 check (units >= 0),
  input jsonb not null default '{}'::jsonb check (pg_column_size(input) < 1200000),
  output jsonb,
  error jsonb,
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) between 1 and 200),
  webhook_url text check (webhook_url is null or char_length(webhook_url) <= 500),
  webhook_status text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index api_jobs_org_created_idx on public.api_jobs(org_id, created_at desc);
create index api_jobs_key_created_idx on public.api_jobs(key_id, created_at desc);
create unique index api_jobs_idempotency_idx on public.api_jobs(org_id, idempotency_key) where idempotency_key is not null;

create table public.ecards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid references public.api_jobs(id) on delete set null,
  spec jsonb not null check (pg_column_size(spec) < 200000),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index ecards_org_idx on public.ecards(org_id, created_at desc);

-- No email addresses here: a recipient is a name, the caller's own reference and merge fields.
create table public.ecard_recipients (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  ecard_id uuid not null references public.ecards(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  ref text not null default '' check (char_length(ref) <= 120),
  fields jsonb not null default '{}'::jsonb check (pg_column_size(fields) < 8000),
  opens int not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz
);
create index ecard_recipients_card_idx on public.ecard_recipients(ecard_id);

alter table public.api_accounts enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_jobs enable row level security;
alter table public.ecards enable row level security;
alter table public.ecard_recipients enable row level security;

-- Supabase grants table rights to these roles by default. Take them all back, then give the
-- browser read access to the safe columns only.
revoke all on public.api_accounts, public.api_keys, public.api_jobs, public.ecards, public.ecard_recipients from anon, authenticated;
grant select on public.api_accounts to authenticated;
grant select (id, org_id, name, prefix, created_by, created_at, last_used_at, revoked_at) on public.api_keys to authenticated;
grant select (id, org_id, key_id, endpoint, status, units, error, created_at, started_at, finished_at) on public.api_jobs to authenticated;

create policy api_accounts_select on public.api_accounts for select to authenticated using (public.can_view_org(org_id));
create policy api_keys_select on public.api_keys for select to authenticated using (public.can_admin_org(org_id) or public.is_staff());
create policy api_jobs_select on public.api_jobs for select to authenticated using (public.can_view_org(org_id));
-- Cards are read by the server only (the public card page and the API), never from a browser session.

-- ---------- Keys: made and revoked by the organisation's owner or admins ----------

-- The server makes the key and passes its hash; the database never sees the key itself.
create or replace function public.create_api_key(p_org uuid, p_name text, p_prefix text, p_hash text, p_webhook_secret text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.can_admin_org(p_org) then
    raise exception 'Only an owner or admin can make API keys.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.api_accounts a where a.org_id = p_org and a.enabled) then
    raise exception 'The API isn''t switched on for this workspace yet. Ask Nka to turn it on.';
  end if;
  if (select count(*) from public.api_keys k where k.org_id = p_org and k.revoked_at is null) >= 10 then
    raise exception 'You have 10 live keys. Revoke one before making another.';
  end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Give the key a name so you can tell it apart later.';
  end if;
  insert into public.api_keys (org_id, name, prefix, key_hash, webhook_secret, created_by)
  values (p_org, left(trim(p_name), 80), p_prefix, p_hash, p_webhook_secret, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.revoke_api_key(p_key uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.api_keys where id = p_key;
  if v_org is null or not (public.can_admin_org(v_org) or public.is_staff()) then
    raise exception 'Only an owner or admin can revoke API keys.' using errcode = '42501';
  end if;
  update public.api_keys set revoked_at = coalesce(revoked_at, now()) where id = p_key;
end $$;

-- Nka switches the API on per client and sets the monthly cap.
create or replace function public.staff_set_api(p_org uuid, p_enabled boolean, p_monthly_credits int, p_per_minute int default 30)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  insert into public.api_accounts (org_id, enabled, monthly_credits, per_minute, updated_at, updated_by)
  values (p_org, p_enabled, p_monthly_credits, p_per_minute, now(), auth.uid())
  on conflict (org_id) do update
    set enabled = excluded.enabled, monthly_credits = excluded.monthly_credits, per_minute = excluded.per_minute,
        updated_at = now(), updated_by = auth.uid();
end $$;

-- ---------- Requests from API callers (service role only) ----------

-- Credits used this calendar month (UTC): finished work, plus work still running so a burst
-- of parallel requests can't run past the cap.
create or replace function public.api_credits_used(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(units), 0)::int from public.api_jobs
  where org_id = p_org and status in ('queued', 'running', 'succeeded')
    and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;

-- Who a key belongs to. Returns null for an unknown or revoked key, or when the API is off.
create or replace function public.api_auth(p_key_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k public.api_keys;
  a public.api_accounts;
begin
  select * into k from public.api_keys where key_hash = p_key_hash and revoked_at is null;
  if not found then return null; end if;
  select * into a from public.api_accounts where org_id = k.org_id;
  if not found or not a.enabled then return null; end if;
  update public.api_keys set last_used_at = now() where id = k.id and (last_used_at is null or last_used_at < now() - interval '1 minute');
  return jsonb_build_object('key_id', k.id, 'org_id', k.org_id, 'created_by', k.created_by,
    'monthly_credits', a.monthly_credits, 'credits_used', public.api_credits_used(k.org_id));
end $$;

-- Checks the key, the per-minute rate and the monthly cap, then records the job. One row lock
-- per organisation makes the checks and the insert a single step.
-- Returns {"job": {...}} or {"error": "code"}; a repeated idempotency key returns the first job
-- with "replayed": true.
create or replace function public.api_begin_job(
  p_key_hash text, p_endpoint text, p_units int, p_input jsonb,
  p_idempotency_key text default null, p_webhook_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k public.api_keys;
  a public.api_accounts;
  j public.api_jobs;
  v_recent int;
begin
  select * into k from public.api_keys where key_hash = p_key_hash and revoked_at is null;
  if not found then return jsonb_build_object('error', 'invalid_key'); end if;
  select * into a from public.api_accounts where org_id = k.org_id for update;
  if not found or not a.enabled then return jsonb_build_object('error', 'api_disabled'); end if;

  if p_idempotency_key is not null then
    select * into j from public.api_jobs where org_id = k.org_id and idempotency_key = p_idempotency_key;
    if found then
      if j.endpoint <> p_endpoint then return jsonb_build_object('error', 'idempotency_mismatch'); end if;
      return jsonb_build_object('job', to_jsonb(j), 'replayed', true);
    end if;
  end if;

  select count(*) into v_recent from public.api_jobs
    where key_id = k.id and created_at > now() - interval '1 minute';
  if v_recent >= a.per_minute then return jsonb_build_object('error', 'rate_limited'); end if;

  if public.api_credits_used(k.org_id) + p_units > a.monthly_credits then
    return jsonb_build_object('error', 'quota_exceeded');
  end if;

  insert into public.api_jobs (org_id, key_id, endpoint, units, input, idempotency_key, webhook_url)
  values (k.org_id, k.id, p_endpoint, p_units, p_input, p_idempotency_key, p_webhook_url)
  returning * into j;
  update public.api_keys set last_used_at = now() where id = k.id;
  return jsonb_build_object('job', to_jsonb(j), 'replayed', false, 'created_by', k.created_by);
end $$;

-- A recipient opened their card. Counted when they tap to open it, not when the page loads,
-- so link previews and scanners don't count.
create or replace function public.ecard_opened(p_token text)
returns void language sql security definer set search_path = public as $$
  update public.ecard_recipients
  set opens = opens + 1, first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now()
  where token = p_token;
$$;

revoke execute on function public.create_api_key(uuid, text, text, text, text), public.revoke_api_key(uuid),
  public.staff_set_api(uuid, boolean, int, int), public.api_credits_used(uuid), public.api_auth(text),
  public.api_begin_job(text, text, int, jsonb, text, text), public.ecard_opened(text)
  from public, anon, authenticated;
grant execute on function public.create_api_key(uuid, text, text, text, text), public.revoke_api_key(uuid),
  public.staff_set_api(uuid, boolean, int, int) to authenticated;
grant execute on function public.api_credits_used(uuid) to authenticated, service_role;
grant execute on function public.api_auth(text), public.api_begin_job(text, text, int, jsonb, text, text),
  public.ecard_opened(text) to service_role;

-- api_credits_used is callable from the browser for the usage panel; only for your own organisation.
create or replace function public.my_api_credits_used(p_org uuid)
returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.can_view_org(p_org) or public.is_staff()) then return 0; end if;
  return public.api_credits_used(p_org);
end $$;
revoke execute on function public.api_credits_used(uuid) from authenticated;
revoke execute on function public.my_api_credits_used(uuid) from public, anon;
grant execute on function public.my_api_credits_used(uuid) to authenticated;

-- ---------- Files made by the API ----------

-- Private. Callers get short-lived signed links in the job result. Path: <org>/<job>/<file>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('api', 'api', false, 26214400)
on conflict (id) do nothing;
