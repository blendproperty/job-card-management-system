create table public.tenant_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  surname text not null check (char_length(btrim(surname)) between 1 and 80),
  company text not null check (char_length(btrim(company)) between 1 and 120),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz not null default now()
);
alter table public.tenant_profiles enable row level security;
revoke all on public.tenant_profiles from public, anon, authenticated;
grant select, insert, update on public.tenant_profiles to authenticated;
create policy tenant_profile_self on public.tenant_profiles to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.tenant_sites()
  ));

create table public.job_requester_contacts (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  first_name text not null,
  surname text not null,
  company text not null,
  email text not null,
  phone text not null
);
alter table public.job_requester_contacts enable row level security;
revoke all on public.job_requester_contacts from public, anon, authenticated;
grant select on public.job_requester_contacts to authenticated;
create policy office_requester_contact on public.job_requester_contacts for select to authenticated
  using (public.is_office(public.job_org(job_id)));

create function public.office_tenant_contacts(p_org uuid)
returns table(user_id uuid, site_id uuid, first_name text, surname text, company text)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.user_id, a.site_id, p.first_name, p.surname, p.company
  from tenant_site_access a
  join tenant_profiles p on p.user_id = a.user_id
  join sites s on s.id = a.site_id
  where s.org_id = p_org and is_office(p_org)
  order by p.surname, p.first_name
$$;
revoke all on function public.office_tenant_contacts(uuid) from public, anon;
grant execute on function public.office_tenant_contacts(uuid) to authenticated;

create function public.snapshot_job_requester() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.requester_user_id is null then return new; end if;
  if not exists (select 1 from sites s where s.id = new.site_id and s.org_id = new.org_id and s.client_id = new.client_id)
    or not exists (
      select 1 from tenant_site_access a
      where a.user_id = new.requester_user_id and a.site_id = new.site_id
    ) then
    raise exception 'Choose a tenant with access to this property.';
  end if;
  insert into job_requester_contacts(job_id,first_name,surname,company,email,phone)
  select new.id,p.first_name,p.surname,p.company,u.email,p.phone
  from tenant_profiles p join auth.users u on u.id = p.user_id
  where p.user_id = new.requester_user_id and u.email is not null;
  if not found then raise exception 'Complete the tenant contact profile before creating this request.'; end if;
  return new;
end
$$;
revoke all on function public.snapshot_job_requester() from public, anon, authenticated;
create trigger job_requester_contact after insert on public.jobs
for each row execute function public.snapshot_job_requester();

notify pgrst, 'reload schema';
