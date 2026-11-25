-- Blend Field (RAM Job Management clone) — first migration. M0 schema as designed in
-- replica/ramtracking/schema.sql on 2026-11-20 (before the Planado merge, which lands as a later migration).
-- All times timestamptz (UTC). Money = integer cents + currency. Access: row level security.

create extension if not exists pgcrypto with schema extensions;

-- ───────────── enums ─────────────
create type member_role   as enum ('admin','office','engineer','contractor');
create type job_stage     as enum ('unassigned','assigned','en_route','arrived','in_progress','pending','completed','cancelled');
create type job_source    as enum ('manual','ppm','mobile','tenant_request');
create type approval_state as enum ('not_required','awaiting','approved','rejected');
create type attachment_kind  as enum ('photo','signature','document');
create type attachment_stage as enum ('before','during','after','other');
create type contact_role  as enum ('owner','tenant','agent','other');
create type channel       as enum ('whatsapp','sms','email');
create type notify_state  as enum ('queued','sent','delivered','read','failed');
create type invoice_state as enum ('draft','issued','paid','void');
create type quote_state   as enum ('draft','sent','approved','rejected','expired');
create type alert_kind    as enum ('overrun','no_checkin','late_start','sync_stale');

-- ───────────── tenancy ─────────────
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Africa/Johannesburg',
  currency char(3) not null default 'ZAR',
  next_job_number integer not null default 1000,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null,
  display_name text not null,
  phone text,
  skills text[] not null default '{}',
  home_lat double precision, home_lng double precision,
  hourly_cost_cents integer check (hourly_cost_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on members (user_id);
create index on members using gin (skills);

create table member_locations (
  member_id uuid primary key references members(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  lat double precision not null, lng double precision not null,
  accuracy_m real, recorded_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index on member_locations (org_id);

create table location_pings (               -- retained 30 days (POPIA), purged by job
  id bigint generated always as identity primary key,
  member_id uuid not null references members(id) on delete cascade,
  job_id uuid,
  lat double precision not null, lng double precision not null,
  accuracy_m real, recorded_at timestamptz not null
);
create index on location_pings (member_id, recorded_at desc);

-- ───────────── clients, sites, contacts ─────────────
create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  billing_email text, billing_address text, vat_number text,
  accounting_ref text,
  approval_threshold_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on clients (org_id, name);

create table sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  client_id uuid not null references clients(id) on delete restrict,
  parent_site_id uuid references sites(id) on delete restrict,
  label text not null,
  address text not null,
  lat double precision, lng double precision,
  geofence_m integer not null default 120 check (geofence_m between 30 and 1000),
  access_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on sites (org_id);
create index on sites (client_id);
create index on sites (parent_site_id);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  site_id uuid references sites(id) on delete cascade,
  role contact_role not null,
  name text not null,
  email text, phone_e164 text,
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  access_windows jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id is not null or site_id is not null)
);
create index on contacts (site_id);
create index on contacts (client_id);

-- ───────────── job config ─────────────
create table job_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  default_estimate_min integer check (default_estimate_min > 0),
  required_skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create table job_statuses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  label text not null,
  stage job_stage not null,
  sort integer not null,
  notify_customer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, label)
);

-- ───────────── forms ─────────────
create table form_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  current_version_id uuid,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on form_templates (org_id);

create table form_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references form_templates(id) on delete cascade,
  version integer not null,
  schema jsonb not null,
  pdf_layout jsonb,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (template_id, version)
);
alter table form_templates
  add foreign key (current_version_id) references form_template_versions(id) on delete set null;

create table job_type_forms (
  job_type_id uuid not null references job_types(id) on delete cascade,
  template_id uuid not null references form_templates(id) on delete cascade,
  required boolean not null default true,
  primary key (job_type_id, template_id)
);
create index on job_type_forms (template_id);

-- ───────────── jobs ─────────────
create table jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  number integer not null,
  client_id uuid not null references clients(id) on delete restrict,
  site_id uuid not null references sites(id) on delete restrict,
  job_type_id uuid references job_types(id) on delete set null,
  status_id uuid references job_statuses(id) on delete set null,
  stage job_stage not null default 'unassigned',
  source job_source not null default 'manual',
  title text not null,
  description text,
  priority smallint not null default 2 check (priority between 1 and 4),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  deadline timestamptz,
  estimate_min integer check (estimate_min > 0),
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  on_site_seconds integer,
  approval approval_state not null default 'not_required',
  locked_at timestamptz,
  ppm_schedule_id uuid,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, number),
  check (scheduled_end is null or scheduled_end > scheduled_start)
);
create index on jobs (org_id, stage, scheduled_start);
create index on jobs (site_id);
create index on jobs (client_id);
create index on jobs (org_id, deadline) where stage not in ('completed','cancelled');

create table job_assignments (
  job_id uuid not null references jobs(id) on delete cascade,
  member_id uuid not null references members(id) on delete restrict,
  is_lead boolean not null default true,
  assigned_at timestamptz not null default now(),
  primary key (job_id, member_id)
);
create index on job_assignments (member_id);

create table job_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  client_op_id uuid unique,
  kind text not null check (kind in ('status','assign','unassign','reschedule','note','approval','lock')),
  from_stage job_stage, to_stage job_stage,
  payload jsonb not null default '{}',
  lat double precision, lng double precision,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index on job_events (job_id, occurred_at);

create table job_forms (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  template_version_id uuid not null references form_template_versions(id) on delete restrict,
  required boolean not null default true,
  unique (job_id, template_version_id)
);
create index on job_forms (template_version_id);

create table form_submissions (
  id uuid primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  job_form_id uuid not null references job_forms(id) on delete cascade,
  answers jsonb not null default '{}',
  completed boolean not null default false,
  completed_by uuid references members(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_form_id)
);

create table attachments (
  id uuid primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  submission_id uuid references form_submissions(id) on delete set null,
  field_key text,
  kind attachment_kind not null,
  stage attachment_stage not null default 'other',
  storage_path text,
  sha256 text,
  bytes integer check (bytes <= 15 * 1024 * 1024),
  signer_name text,
  taken_at timestamptz not null,
  lat double precision, lng double precision,
  uploaded_at timestamptz,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on attachments (job_id);
create index on attachments (submission_id);

-- ───────────── assets & PPM ─────────────
create table assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  site_id uuid not null references sites(id) on delete restrict,
  type text not null,
  make text, model text, serial text,
  qr_code text not null default encode(extensions.gen_random_bytes(9),'hex'),
  installed_on date, warranty_until date,
  custom jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, qr_code)
);
create index on assets (site_id);

create table ppm_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  job_type_id uuid references job_types(id) on delete set null,
  rrule text not null,
  next_due date not null,
  lead_days integer not null default 14,
  remind_days integer not null default 7,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on ppm_schedules (org_id, next_due) where active;
create index on ppm_schedules (asset_id);
alter table jobs add foreign key (ppm_schedule_id) references ppm_schedules(id) on delete set null;
create unique index one_job_per_ppm_due on jobs (ppm_schedule_id, deadline)
  where ppm_schedule_id is not null;

create table service_records (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  notes text,
  performed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on service_records (asset_id, performed_at desc);
create index on service_records (job_id);

-- ───────────── money ─────────────
create table quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  state quote_state not null default 'draft',
  total_cents integer not null default 0 check (total_cents >= 0),
  currency char(3) not null default 'ZAR',
  approval_token_hash text,
  sent_at timestamptz, decided_at timestamptz,
  decided_by_contact uuid references contacts(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on quotes (job_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  client_id uuid not null references clients(id) on delete restrict,
  state invoice_state not null default 'draft',
  subtotal_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_cents integer not null default 0,
  currency char(3) not null default 'ZAR',
  external_ref text,
  issued_at timestamptz, due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on invoices (org_id, state);
create index on invoices (client_id);
create unique index one_invoice_per_job on invoices (job_id) where state <> 'void';

create table line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  kind text not null check (kind in ('labour','part','callout','other')),
  description text not null,
  qty numeric(10,2) not null check (qty > 0),
  unit_cents integer not null,
  vat_rate numeric(4,2) not null default 15.00,
  sort integer not null default 0,
  check ((quote_id is null) <> (invoice_id is null))
);
create index on line_items (quote_id);
create index on line_items (invoice_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete restrict,
  provider text not null check (provider in ('yoco','paystack','eft','cash')),
  provider_ref text,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null default 'ZAR',
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index on payments (invoice_id);

-- ───────────── comms, alerts, integrations ─────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  channel channel not null,
  template text not null,
  dedupe_key text not null,
  state notify_state not null default 'queued',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, dedupe_key)
);
create index on notifications (job_id);
create index on notifications (provider_message_id);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind alert_kind not null,
  job_id uuid references jobs(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  raised_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index one_open_alert on alerts (kind, job_id) where resolved_at is null;
create index on alerts (org_id) where resolved_at is null;

create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  provider text not null check (provider in ('xero','yoco','paystack','whatsapp')),
  external_tenant_id text,
  secret_id uuid,
  status text not null default 'connected' check (status in ('connected','error','disconnected')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create table webhook_events (
  provider text not null,
  external_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null,
  primary key (provider, external_id)
);

-- ───────────── functions & triggers ─────────────
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['orgs','members','clients','sites','contacts','job_types','job_statuses',
    'form_templates','jobs','form_submissions','assets','ppm_schedules','quotes','invoices','integrations']
  loop execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop; end $$;

create or replace function assign_job_number() returns trigger language plpgsql as $$
begin
  update orgs set next_job_number = next_job_number + 1
   where id = new.org_id returning next_job_number - 1 into new.number;
  return new;
end $$;
create trigger jobs_number before insert on jobs for each row when (new.number is null)
  execute function assign_job_number();

create or replace function forbid_locked_job_edit() returns trigger language plpgsql as $$
begin
  if old.locked_at is not null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'job % is locked', old.number using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger jobs_locked before update on jobs for each row execute function forbid_locked_job_edit();

-- ───────────── row level security ─────────────
create or replace function my_org_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from members where user_id = auth.uid() and active $$;
create or replace function my_role(p_org uuid) returns member_role language sql stable security definer set search_path = public as $$
  select role from members where user_id = auth.uid() and org_id = p_org and active $$;
create or replace function is_office(p_org uuid) returns boolean language sql stable as $$
  select coalesce(my_role(p_org) in ('admin','office'), false) $$;
create or replace function assigned_to_me(p_job uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from job_assignments a join members m on m.id = a.member_id
                 where a.job_id = p_job and m.user_id = auth.uid() and m.active) $$;
create or replace function job_org(p_job uuid) returns uuid language sql stable security definer set search_path = public as $$
  select org_id from jobs where id = p_job $$;

do $$ declare t text; begin
  foreach t in array array['orgs','members','member_locations','location_pings','clients','sites','contacts',
    'job_types','job_statuses','form_templates','form_template_versions','job_type_forms','jobs',
    'job_assignments','job_events','job_forms','form_submissions','attachments','assets','ppm_schedules',
    'service_records','quotes','invoices','line_items','payments','notifications','alerts','integrations',
    'webhook_events']
  loop execute format('alter table %I enable row level security', t);
  end loop; end $$;

do $$ declare t text; begin
  foreach t in array array['clients','sites','contacts','jobs','assets','quotes','invoices','payments',
    'ppm_schedules','job_types','job_statuses','form_templates','alerts']
  loop execute format('create policy office_all on %I for all using (is_office(org_id)) with check (is_office(org_id))', t);
  end loop; end $$;
create policy office_read on notifications for select using (is_office(org_id));
create policy admin_only on integrations for all using (my_role(org_id) = 'admin') with check (my_role(org_id) = 'admin');
create policy members_read on members for select using (org_id in (select my_org_ids()));
create policy admin_write on members for all using (my_role(org_id) = 'admin') with check (my_role(org_id) = 'admin');
create policy org_read on orgs for select using (id in (select my_org_ids()));
create policy office_read on member_locations for select using (is_office(org_id));
create policy self_write on member_locations for all
  using (member_id in (select id from members where user_id = auth.uid()))
  with check (member_id in (select id from members where user_id = auth.uid()));
create policy office_read on job_type_forms for select
  using (exists (select 1 from job_types jt where jt.id = job_type_id and is_office(jt.org_id)));
create policy office_read on service_records for select
  using (exists (select 1 from assets a where a.id = asset_id and is_office(a.org_id)));
create policy office_read on line_items for select using (
  exists (select 1 from quotes q where q.id = quote_id and is_office(q.org_id)) or
  exists (select 1 from invoices i where i.id = invoice_id and is_office(i.org_id)));

create policy field_read on jobs for select using (assigned_to_me(id));
create policy field_read on sites for select
  using (exists (select 1 from jobs j where j.site_id = sites.id and assigned_to_me(j.id)));
create policy field_read on contacts for select
  using (exists (select 1 from jobs j where j.site_id = contacts.site_id and assigned_to_me(j.id)));
create policy field_read on assets for select
  using (exists (select 1 from jobs j where j.site_id = assets.site_id and assigned_to_me(j.id)));
create policy job_rw on job_events for all using (assigned_to_me(job_id) or is_office(org_id))
  with check (assigned_to_me(job_id) or is_office(org_id));
create policy job_rw on attachments for all using (assigned_to_me(job_id) or is_office(org_id))
  with check (assigned_to_me(job_id) or is_office(org_id));
create policy job_read on job_forms for select using (assigned_to_me(job_id) or is_office(job_org(job_id)));
create policy office_write on job_forms for all using (is_office(job_org(job_id))) with check (is_office(job_org(job_id)));
create policy job_rw on form_submissions for all
  using (is_office(org_id) or exists (select 1 from job_forms f where f.id = job_form_id and assigned_to_me(f.job_id)))
  with check (is_office(org_id) or exists (select 1 from job_forms f where f.id = job_form_id and assigned_to_me(f.job_id)));
create policy read_versions on form_template_versions for select
  using (exists (select 1 from form_templates t where t.id = template_id and t.org_id in (select my_org_ids())));
create policy read_assign on job_assignments for select
  using (assigned_to_me(job_id) or is_office(job_org(job_id)));
create policy office_assign on job_assignments for all
  using (is_office(job_org(job_id))) with check (is_office(job_org(job_id)));
