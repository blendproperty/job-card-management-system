alter table public.jobs add column requester_user_id uuid references auth.users(id) on delete set null;
create index on public.jobs (requester_user_id, created_at desc) where requester_user_id is not null;

create table public.tenant_site_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  primary key (user_id, site_id)
);
alter table public.tenant_site_access enable row level security;
revoke all on public.tenant_site_access from public, anon, authenticated;

create function public.tenant_sites() returns table(id uuid, label text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id, s.label from tenant_site_access a join sites s on s.id = a.site_id
  where a.user_id = auth.uid() order by s.label
$$;

create function public.tenant_requests() returns table(number integer, title text, status text, logged_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select j.number, j.title,
    case when j.approval = 'rejected' then 'Declined'
         when j.approval = 'awaiting' then 'Awaiting approval'
         when exists (select 1 from job_events e where e.job_id = j.id and e.payload->>'review' = 'close') then 'Closed'
         when j.stage = 'completed' then 'Awaiting final review'
         else initcap(replace(j.stage::text,'_',' ')) end,
    j.created_at
  from jobs j
  join tenant_site_access a on a.site_id = j.site_id and a.user_id = j.requester_user_id
  where j.requester_user_id = auth.uid()
  order by j.created_at desc limit 100
$$;

create function public.submit_tenant_request(p_site uuid, p_trade text, p_title text, p_description text) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  site sites;
  job_number integer;
begin
  select s.* into site from sites s join tenant_site_access a on a.site_id = s.id
  where a.user_id = auth.uid() and s.id = p_site for key share of a;
  if not found then raise exception 'Choose a property you have access to.'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 3 and 120
     or p_description is null or char_length(btrim(p_description)) not between 1 and 2000
     or p_trade is null or p_trade not in ('general maintenance','plumbing','electrical','other') then
    raise exception 'Enter a trade, title and details.';
  end if;
  insert into jobs (org_id, client_id, site_id, trade, title, description, source, approval, requester_user_id)
  values (site.org_id, site.client_id, site.id, p_trade, btrim(p_title), btrim(p_description), 'tenant_request', 'awaiting', auth.uid())
  returning number into job_number;
  return job_number;
end;
$$;
revoke all on function public.tenant_sites(), public.tenant_requests(), public.submit_tenant_request(uuid,text,text,text) from public, anon;
grant execute on function public.tenant_sites(), public.tenant_requests(), public.submit_tenant_request(uuid,text,text,text) to authenticated;
notify pgrst, 'reload schema';
