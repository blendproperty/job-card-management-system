create table public.people_register (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('tenant','trade')),
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  surname text not null check (char_length(btrim(surname)) between 1 and 80),
  company text not null check (char_length(btrim(company)) between 1 and 120),
  email text not null check (email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  trade text not null default '',
  updated_at timestamptz not null default now(),
  check ((kind = 'tenant' and trade = '') or (kind = 'trade' and trade in ('general maintenance','plumbing','electrical','other'))),
  unique (org_id,site_id,kind,email,trade)
);
alter table public.people_register enable row level security;
revoke all on public.people_register from public, anon, authenticated;
grant select, insert, update on public.people_register to authenticated;
create policy office_people_register on public.people_register for all to authenticated
using (public.is_office(org_id))
with check (
  public.is_office(org_id)
  and exists (select 1 from public.sites s where s.id = people_register.site_id and s.org_id = people_register.org_id)
);

create table public.people_register_audit (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  record_id uuid not null,
  actor_id uuid,
  action text not null check (action in ('INSERT','UPDATE')),
  occurred_at timestamptz not null default now()
);
alter table public.people_register_audit enable row level security;
revoke all on public.people_register_audit from public, anon, authenticated;
grant select on public.people_register_audit to authenticated;
create policy office_people_register_audit on public.people_register_audit for select to authenticated
using (public.is_office(org_id));

create function public.audit_people_register() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into people_register_audit(org_id,record_id,actor_id,action)
  values (new.org_id,new.id,auth.uid(),tg_op);
  return new;
end $$;
revoke all on function public.audit_people_register() from public, anon, authenticated;
create trigger people_register_change after insert or update on public.people_register
for each row execute function public.audit_people_register();

notify pgrst, 'reload schema';
