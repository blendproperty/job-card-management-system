create table public.site_dispatch_rules (
  site_id uuid not null references public.sites(id) on delete cascade,
  trade text not null check (trade in ('general maintenance','plumbing','electrical','other')),
  member_id uuid not null references public.members(id) on delete cascade,
  primary key (site_id, trade)
);
alter table public.site_dispatch_rules enable row level security;
revoke all on public.site_dispatch_rules from public, anon, authenticated;
grant select on public.site_dispatch_rules to authenticated;
create policy office_dispatch_rules on public.site_dispatch_rules for select to authenticated
using (exists (select 1 from public.sites s where s.id = site_id and public.is_office(s.org_id)));

create function public.set_site_dispatch_rule(p_site uuid, p_trade text, p_member uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  organisation uuid;
begin
  select org_id into organisation from sites where id = p_site;
  if not found or not is_office(organisation) then raise exception 'Property not found.'; end if;
  if p_trade is null or p_trade not in ('general maintenance','plumbing','electrical','other') then
    raise exception 'Choose a trade.';
  end if;
  if p_member is null then
    delete from site_dispatch_rules where site_id = p_site and trade = p_trade;
  else
    if not exists (select 1 from members m where m.id = p_member and m.org_id = organisation and m.active
      and m.role in ('engineer','contractor') and p_trade = any(m.skills)) then
      raise exception 'Choose an active worker with that trade in this organisation.';
    end if;
    insert into site_dispatch_rules (site_id, trade, member_id) values (p_site, p_trade, p_member)
    on conflict (site_id, trade) do update set member_id = excluded.member_id;
  end if;
end $$;
revoke all on function public.set_site_dispatch_rule(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.set_site_dispatch_rule(uuid,text,uuid) to authenticated;

-- All assignment entry points use the same validation, locking and audit path.
create function public.apply_job_assignment(p_job uuid, p_members uuid[], p_actor uuid, p_mode text)
returns jobs language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j jobs;
  valid uuid[];
  previous_members uuid[];
  previous_stage job_stage;
begin
  select * into j from jobs where id = p_job for update;
  if not found then raise exception 'Job not found.' using errcode = 'P0002'; end if;
  if j.locked_at is not null or j.stage in ('completed','cancelled') then
    raise exception 'This job is closed for assignment.';
  end if;
  select array_agg(m.id order by array_position(p_members, m.id)) into valid
    from members m where m.id = any(p_members) and m.org_id = j.org_id and m.active and m.role in ('engineer','contractor');
  if valid is null then raise exception 'Pick someone to do the job.'; end if;
  select array_agg(member_id order by is_lead desc, member_id) into previous_members from job_assignments where job_id = p_job;
  if previous_members = valid then return j; end if;
  delete from job_assignments where job_id = p_job;
  insert into job_assignments (job_id, member_id, is_lead)
    select p_job, m, ord = 1 from unnest(valid) with ordinality as t(m, ord);

  previous_stage := j.stage;
  update jobs set stage = case when stage = 'unassigned' then 'assigned'::job_stage else stage end
   where id = p_job returning * into j;
  insert into job_events (org_id, job_id, member_id, kind, from_stage, to_stage, payload, occurred_at)
    values (j.org_id, j.id, p_actor, 'assign', previous_stage, j.stage,
      jsonb_build_object('member_ids', valid, 'dispatch', p_mode, 'trade', j.trade, 'site_id', j.site_id), now());
  return j;
end $$;
revoke all on function public.apply_job_assignment(uuid,uuid[],uuid,text) from public, anon, authenticated;

create or replace function public.assign_job(p_job uuid, p_members uuid[])
returns jobs language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j jobs;
  actor_id uuid;
begin
  select * into j from jobs where id = p_job;
  if not found or not is_office(j.org_id) then raise exception 'Job not found.' using errcode = 'P0002'; end if;
  select id into actor_id from members where user_id = auth.uid() and org_id = j.org_id and active;
  return apply_job_assignment(p_job, p_members, actor_id, 'manual');
end $$;

create table public.workflow_alerts (
  event_id uuid not null references public.job_events(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience in ('tenant','trade')),
  message text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, audience)
);
create index on public.workflow_alerts (user_id, audience, created_at desc);
alter table public.workflow_alerts enable row level security;
revoke all on public.workflow_alerts from public, anon, authenticated;

create function public.record_workflow_alert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j jobs;
  tenant_message text;
begin
  select * into j from jobs where id = new.job_id;
  if new.kind = 'assign' then
    insert into workflow_alerts (event_id, job_id, user_id, audience, message)
    select new.id, j.id, m.user_id, 'trade', 'New job assigned'
    from job_assignments a join members m on m.id = a.member_id where a.job_id = j.id and m.user_id is not null
    on conflict do nothing;
    tenant_message := 'A contractor has been assigned to your request';
  elsif new.payload->>'dispatch' = 'review' then
    tenant_message := 'Request received. The property team will review it';
  elsif new.kind = 'approval' then
    tenant_message := case new.payload->>'review'
      when 'reject' then 'The property team declined your request'
      when 'close' then 'The property team closed your request'
      when 'approve' then 'Your request was approved'
    end;
  elsif new.kind = 'status' then
    tenant_message := case new.to_stage
      when 'en_route' then 'Your contractor is on the way'
      when 'completed' then 'The contractor finished the visit. The property team will review the job'
    end;
  end if;
  if tenant_message is not null and j.requester_user_id is not null then
    insert into workflow_alerts (event_id, job_id, user_id, audience, message)
    values (new.id, j.id, j.requester_user_id, 'tenant', tenant_message);
  end if;
  return new;
end $$;
revoke all on function public.record_workflow_alert() from public, anon, authenticated;
create trigger job_workflow_alert after insert on public.job_events
for each row execute function public.record_workflow_alert();

create function public.my_workflow_alerts(p_audience text)
returns table(event_id uuid, job_id uuid, number integer, message text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select n.event_id, n.job_id, j.number, n.message, n.created_at
  from workflow_alerts n join jobs j on j.id = n.job_id
  where n.user_id = auth.uid() and n.audience = p_audience
    and ((p_audience = 'tenant' and j.requester_user_id = auth.uid()
          and exists (select 1 from tenant_site_access a where a.user_id = auth.uid() and a.site_id = j.site_id))
      or (p_audience = 'trade' and assigned_to_me(j.id)))
  order by n.created_at desc, n.event_id desc limit 20
$$;
revoke all on function public.my_workflow_alerts(text) from public, anon, authenticated;
grant execute on function public.my_workflow_alerts(text) to authenticated;

create function public.submit_tenant_request(p_site uuid, p_trade text, p_title text, p_description text, p_manual boolean) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  site sites;
  job jobs;
  worker uuid;
begin
  select s.* into site from sites s join tenant_site_access a on a.site_id = s.id
  where a.user_id = auth.uid() and s.id = p_site for key share of a;
  if not found then raise exception 'Choose a property you have access to.'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 3 and 120
     or p_description is null or char_length(btrim(p_description)) not between 1 and 2000
     or p_trade is null or p_trade not in ('general maintenance','plumbing','electrical','other') then
    raise exception 'Enter a trade, title and details.';
  end if;
  if not coalesce(p_manual, true) and p_trade <> 'other' then
    select m.id into worker from site_dispatch_rules r join members m on r.member_id = m.id
    where r.site_id = site.id and r.trade = p_trade and m.org_id = site.org_id
      and m.active and m.role in ('engineer','contractor') and p_trade = any(m.skills)
    for share of r, m;
  end if;
  insert into jobs (org_id, client_id, site_id, trade, title, description, source, approval, requester_user_id)
  values (site.org_id, site.client_id, site.id, p_trade, btrim(p_title), btrim(p_description), 'tenant_request',
    case when worker is null then 'awaiting'::approval_state else 'approved'::approval_state end, auth.uid())
  returning * into job;
  if worker is not null then
    perform apply_job_assignment(job.id, array[worker], null, 'automatic');
  else
    insert into job_events(org_id, job_id, kind, payload, occurred_at)
    values (job.org_id, job.id, 'note', jsonb_build_object('dispatch', 'review', 'reason',
      case when coalesce(p_manual, true) then 'Special requirements'
        when p_trade = 'other' then 'Unclassified work' else 'No eligible property and trade rule' end), now());
  end if;
  return job.number;
end $$;
revoke all on function public.submit_tenant_request(uuid,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.submit_tenant_request(uuid,text,text,text,boolean) to authenticated;

create or replace function public.submit_tenant_request(p_site uuid, p_trade text, p_title text, p_description text) returns integer
language sql security definer set search_path = public, pg_temp as $$
  select submit_tenant_request(p_site, p_trade, p_title, p_description, false)
$$;
create or replace function public.review_job(p_job uuid, p_decision text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j jobs;
  actor members;
  worker uuid;
  overtime integer;
begin
  select * into j from jobs where id = p_job for update;
  if not found then raise exception 'Job not found.' using errcode = 'P0002'; end if;
  select * into actor from members where user_id = auth.uid() and org_id = j.org_id and active;
  if not found or actor.role not in ('admin','office','facility_manager') then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if p_decision in ('close','close_approve_overtime','close_decline_overtime') then
    if actor.role not in ('admin','facility_manager') or j.stage <> 'completed' then
      raise exception 'A facility manager or administrator can close the job after field completion.';
    end if;
    if exists (select 1 from job_events where job_id = p_job and payload->>'review' = 'close') then
      return;
    end if;
    if exists (select 1 from resolutions where id = j.resolution_id and successful) and (
      not exists (select 1 from attachments where job_id = p_job and kind = 'photo' and stage = 'before' and uploaded_at is not null)
      or not exists (select 1 from attachments where job_id = p_job and kind = 'photo' and stage = 'after' and uploaded_at is not null)
      or not exists (select 1 from attachments where job_id = p_job and kind = 'signature' and uploaded_at is not null)
    ) then raise exception 'Closure requires uploaded before and after photos and a customer signature.'; end if;
    select coalesce((payload->>'overtime_minutes')::integer,0) into overtime
      from job_events where job_id = p_job and to_stage = 'completed'
      order by occurred_at desc limit 1;
    if coalesce(overtime,0) > 0 and p_decision = 'close' then
      raise exception 'Approve or decline reported overtime before closing.';
    end if;
  elsif p_decision in ('approve','reject') then
    if j.approval <> 'awaiting' or j.stage <> 'unassigned' then
      raise exception 'This request is no longer awaiting approval.';
    end if;
    update jobs set approval = case when p_decision = 'approve' then 'approved'::approval_state else 'rejected'::approval_state end where id = p_job;
    if p_decision = 'approve' and j.source <> 'tenant_request' then
      select m.id into worker
        from members m
        where m.org_id = j.org_id and m.active and m.role in ('engineer','contractor')
          and (m.id = j.preferred_worker or j.trade = any(m.skills))
        order by (m.id is not distinct from j.preferred_worker) desc,
          (select count(*) from job_assignments a join jobs other on other.id = a.job_id
            where a.member_id = m.id and other.stage not in ('completed','cancelled')),
          m.id
        limit 1;
      if worker is not null then perform assign_job(p_job, array[worker]); end if;
    end if;
  else
    raise exception 'Choose a valid review action.';
  end if;

  insert into job_events(org_id, job_id, member_id, kind, payload, occurred_at)
  values (j.org_id, j.id, actor.id, 'approval', case when p_decision like 'close%' then jsonb_build_object(
    'review', 'close', 'approved_overtime_minutes', case when p_decision = 'close_approve_overtime' then coalesce(overtime,0) else 0 end)
  else jsonb_build_object('review', p_decision) end, now());
end;
$$;

notify pgrst, 'reload schema';
