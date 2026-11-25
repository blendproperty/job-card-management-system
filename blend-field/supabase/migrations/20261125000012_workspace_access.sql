create or replace function public.is_office(p_org uuid) returns boolean
language sql stable set search_path = public, pg_temp as $$
  select coalesce(my_role(p_org) in ('admin','office','facility_manager','property_manager','asset_manager'), false)
$$;

-- Legacy demo and operational grants retain the capability they already had.
alter table public.tenant_site_access add column can_request boolean not null default true;
alter table public.tenant_site_access alter column can_request set default false;

create function public.requestable_tenant_sites() returns table(id uuid, label text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id,s.label from tenant_site_access a join sites s on s.id = a.site_id
  where a.user_id = auth.uid() and a.can_request order by s.label
$$;
revoke all on function public.requestable_tenant_sites() from public, anon, authenticated;
grant execute on function public.requestable_tenant_sites() to authenticated;

drop policy tenant_profile_self on public.tenant_profiles;
create policy tenant_profile_read_self on public.tenant_profiles for select to authenticated
using (user_id = auth.uid());
create policy tenant_profile_write_self on public.tenant_profiles for all to authenticated
using (user_id = auth.uid() and exists(select 1 from public.requestable_tenant_sites()))
with check (user_id = auth.uid() and exists(select 1 from public.requestable_tenant_sites()));

create function public.tenant_request_permission() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from tenant_site_access a where a.site_id = new.site_id and a.user_id = new.requester_user_id and a.can_request for share;
  if not found then raise exception 'This account has view-only access for this property.' using errcode = '42501'; end if;
  return new;
end $$;
revoke all on function public.tenant_request_permission() from public, anon, authenticated;
create trigger tenant_request_requires_permission before insert on public.jobs
for each row when (new.source = 'tenant_request') execute function public.tenant_request_permission();

create table public.workspace_access_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  actor_id uuid not null,
  user_id uuid not null,
  site_id uuid,
  change text not null,
  occurred_at timestamptz not null default now()
);
alter table public.workspace_access_events enable row level security;
revoke all on public.workspace_access_events from public, anon, authenticated;
grant select on public.workspace_access_events to authenticated;
create policy admin_access_events on public.workspace_access_events for select
to authenticated using (public.my_role(org_id) = 'admin');

create function public.save_workspace_manager(p_org uuid, p_email text, p_name text, p_role text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  selected_user uuid;
  existing members;
begin
  if my_role(p_org) is distinct from 'admin'::member_role then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('facility_manager','asset_manager','property_manager')
    or p_name is null or char_length(btrim(p_name)) not between 2 and 120 then raise exception 'Choose a manager name and role.'; end if;
  select u.id into selected_user from auth.users u where lower(u.email) = lower(p_email) for update of u;
  if selected_user is null then raise exception 'Sign-in account is missing.'; end if;
  if exists (select 1 from members m where m.user_id=selected_user and m.org_id<>p_org and m.active)
    or exists (select 1 from tenant_site_access a where a.user_id=selected_user) then
    raise exception 'Use a separate sign-in address for this manager.';
  end if;
  select * into existing from members m where m.user_id=selected_user and m.org_id=p_org for update;
  if existing.id is not null and existing.role not in ('office','facility_manager','asset_manager','property_manager') then
    raise exception 'This sign-in already has a different role.';
  end if;
  insert into members(org_id,user_id,role,display_name,active)
  values (p_org,selected_user,p_role::member_role,btrim(p_name),true)
  on conflict (org_id,user_id) do update set role=excluded.role,display_name=excluded.display_name,active=true;
  if existing.role::text is distinct from p_role or existing.display_name is distinct from btrim(p_name) or not existing.active then
    insert into workspace_access_events(org_id,actor_id,user_id,change) values (p_org,auth.uid(),selected_user,'manager:'||p_role);
  end if;
end $$;

create function public.set_workspace_manager_active(p_org uuid, p_member uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target members;
begin
  if my_role(p_org) is distinct from 'admin'::member_role then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  select m.* into target from members m join auth.users u on u.id=m.user_id where m.id=p_member and m.org_id=p_org
    and m.role in ('office','facility_manager','asset_manager','property_manager') for update of u;
  if not found or p_active is null then raise exception 'Manager not found.'; end if;
  if target.active = p_active then return; end if;
  if p_active and exists (select 1 from members m where m.user_id=target.user_id and m.org_id<>p_org and m.active) then
    raise exception 'This sign-in is active in another organisation.';
  end if;
  update members set active=p_active where id=p_member;
  insert into workspace_access_events(org_id,actor_id,user_id,change)
  values (p_org,auth.uid(),target.user_id,case when p_active then 'manager:enabled' else 'manager:disabled' end);
end $$;

create function public.set_workspace_tenant(p_org uuid, p_contact uuid, p_mode text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  contact people_register;
  selected_user uuid;
  changed integer;
begin
  if my_role(p_org) is distinct from 'admin'::member_role then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('disabled','view','request') then raise exception 'Choose an access level.'; end if;
  select r.* into contact from people_register r join sites s on s.id=r.site_id and s.org_id=r.org_id
  where r.id=p_contact and r.org_id=p_org and r.kind='tenant';
  if not found then raise exception 'Tenant contact not found.'; end if;
  select u.id into selected_user from auth.users u where lower(u.email)=contact.email for update of u;
  if selected_user is null then
    if p_mode='disabled' then return; end if;
    raise exception 'Sign-in account is missing.';
  end if;
  if p_mode='disabled' then
    delete from tenant_site_access where user_id=selected_user and site_id=contact.site_id;
  else
    if exists (select 1 from members m where m.user_id=selected_user) then
      raise exception 'Use a separate sign-in address for this tenant.';
    end if;
    insert into tenant_profiles(user_id,first_name,surname,company,phone)
    values (selected_user,contact.first_name,contact.surname,contact.company,contact.phone)
    on conflict (user_id) do nothing;
    insert into tenant_site_access(user_id,site_id,can_request) values (selected_user,contact.site_id,p_mode='request')
    on conflict (user_id,site_id) do update set can_request=excluded.can_request
    where tenant_site_access.can_request is distinct from excluded.can_request;
  end if;
  get diagnostics changed = row_count;
  if p_mode <> 'request' and not exists(select 1 from tenant_site_access a where a.user_id=selected_user and a.can_request) then
    delete from workflow_email_preferences where user_id=selected_user and audience='tenant';
  end if;
  if changed > 0 then
    insert into workspace_access_events(org_id,actor_id,user_id,site_id,change)
    values (p_org,auth.uid(),selected_user,contact.site_id,'tenant:'||p_mode);
  end if;
end $$;

create or replace function public.set_workflow_email(p_audience text, p_enabled boolean) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or p_enabled is null or p_audience is null or p_audience not in ('tenant','trade') then
    raise exception 'Invalid notification preference.';
  end if;
  if not p_enabled then
    delete from workflow_email_preferences where user_id = auth.uid() and audience = p_audience;
  elsif (p_audience = 'tenant' and exists (select 1 from tenant_site_access where user_id = auth.uid() and can_request))
    or (p_audience = 'trade' and exists (select 1 from members where user_id = auth.uid() and active and role in ('engineer','contractor'))) then
    insert into workflow_email_preferences(user_id, audience) values (auth.uid(), p_audience) on conflict do nothing;
  else
    raise exception 'This account is not eligible for that preference.';
  end if;
  return p_enabled;
end $$;
create table public.workspace_tenant_invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  site_id uuid not null,
  state text not null default 'queued' check (state in ('queued','sending','accepted','failed','uncertain','skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,site_id),
  foreign key (user_id,site_id) references public.tenant_site_access(user_id,site_id) on delete cascade
);
alter table public.workspace_tenant_invites enable row level security;
revoke all on public.workspace_tenant_invites from public, anon, authenticated;
create index on public.workspace_tenant_invites(next_attempt_at,id) where state='queued';

create function public.queue_workspace_tenant_invite(p_org uuid,p_contact uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  selected_user uuid;
  selected_site uuid;
begin
  if my_role(p_org) is distinct from 'admin'::member_role then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  select a.user_id,a.site_id into selected_user,selected_site from people_register r
  join auth.users u on lower(u.email)=r.email
  join tenant_site_access a on a.user_id=u.id and a.site_id=r.site_id
  join sites s on s.id=r.site_id and s.org_id=r.org_id
  where r.org_id=p_org and r.id=p_contact and r.kind='tenant' and not a.can_request
  for share of a;
  if not found then raise exception 'Enable view-only access before emailing an invitation.'; end if;

  insert into workspace_tenant_invites(user_id,site_id) values (selected_user,selected_site)
  on conflict (user_id,site_id) do update set state='queued',attempts=0,next_attempt_at=now(),updated_at=now()
  where workspace_tenant_invites.state in ('failed','skipped');
  if found then
    insert into workspace_access_events(org_id,actor_id,user_id,site_id,change)
    values (p_org,auth.uid(),selected_user,selected_site,'tenant:invitation_queued');
  end if;
end $$;

create function public.claim_workspace_tenant_invite()
returns table(id uuid,email text,property text,attempt integer)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update workspace_tenant_invites d set state='uncertain',updated_at=now()
  where d.state='sending' and d.updated_at<now()-interval '5 minutes';

  return query
  with pending as (
    select d.id,u.email::text as recipient,s.label,a.can_request
    from workspace_tenant_invites d join tenant_site_access a using(user_id,site_id)
    join auth.users u on u.id=d.user_id join sites s on s.id=d.site_id
    where d.state='queued' and d.next_attempt_at<=now()
    order by d.next_attempt_at,d.id for update of d skip locked limit 1
  )
  update workspace_tenant_invites d
  set state=case when p.can_request or p.recipient is null then 'skipped' else 'sending' end,
      attempts=d.attempts+case when p.can_request or p.recipient is null then 0 else 1 end,
      updated_at=now()
  from pending p where d.id=p.id
  returning d.id,case when d.state='sending' then p.recipient end,
    case when d.state='sending' then p.label end,d.attempts;
end $$;

create function public.finish_workspace_tenant_invite(p_id uuid,p_attempt integer,p_outcome text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_outcome is null or p_outcome not in ('accepted','retry','failed','uncertain') then
    raise exception 'Invalid invitation outcome.';
  end if;
  update workspace_tenant_invites d
  set state=case when p_outcome='retry' then case when attempts<4 then 'queued' else 'failed' end else p_outcome end,
      next_attempt_at=now()+interval '1 minute'*power(2,attempts-1),updated_at=now()
  where d.id=p_id and d.state='sending' and d.attempts=p_attempt;
  return found;
end $$;
revoke all on function public.queue_workspace_tenant_invite(uuid,uuid) from public, anon, authenticated;
grant execute on function public.queue_workspace_tenant_invite(uuid,uuid) to authenticated;
revoke all on function public.claim_workspace_tenant_invite(), public.finish_workspace_tenant_invite(uuid,integer,text)
from public, anon, authenticated;
grant execute on function public.claim_workspace_tenant_invite(), public.finish_workspace_tenant_invite(uuid,integer,text)
to workflow_email_sender;

create function public.workspace_access_list(p_org uuid)
returns table(id uuid, role text, name text, email text, site text, access text, invitation text)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id,m.role::text as role,m.display_name as name,u.email::text as email,null::text,case when m.active then 'active' else 'disabled' end,null::text
  from members m join auth.users u on u.id=m.user_id
  where my_role(p_org)='admin' and m.org_id=p_org
  union all
  select r.id,'tenant',concat_ws(' ',r.first_name,r.surname),r.email,s.label,
    case when a.user_id is null then 'held' when a.can_request then 'request' else 'view' end,d.state
  from people_register r join sites s on s.id=r.site_id and s.org_id=r.org_id
  left join auth.users u on lower(u.email)=r.email
  left join tenant_site_access a on a.user_id=u.id and a.site_id=r.site_id
  left join workspace_tenant_invites d on d.user_id=a.user_id and d.site_id=a.site_id
  where my_role(p_org)='admin' and r.org_id=p_org and r.kind='tenant'
  order by role,name,email
$$;

revoke all on function public.save_workspace_manager(uuid,text,text,text),
  public.set_workspace_manager_active(uuid,uuid,boolean), public.set_workspace_tenant(uuid,uuid,text),
  public.workspace_access_list(uuid) from public, anon, authenticated;
grant execute on function public.save_workspace_manager(uuid,text,text,text),
  public.set_workspace_manager_active(uuid,uuid,boolean), public.set_workspace_tenant(uuid,uuid,text),
  public.workspace_access_list(uuid) to authenticated;
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
  if not found or not is_office(j.org_id) then
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


create or replace function public.enqueue_workflow_email() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into workflow_email_deliveries(event_id,user_id,audience)
  select new.event_id,new.user_id,new.audience
  from workflow_email_preferences p join auth.users u on u.id = p.user_id
  where p.user_id = new.user_id and p.audience = new.audience
    and u.email is not null and u.email_confirmed_at is not null
    and (new.audience <> 'tenant' or exists (
      select 1 from jobs j join tenant_site_access a on a.site_id=j.site_id
      where j.id=new.job_id and a.user_id=new.user_id and a.can_request
    ))
  on conflict do nothing;
  return new;
end $$;
create or replace function public.claim_workflow_email()
returns table(id uuid, email text, number integer, audience text, message text, attempt integer)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- A worker can be interrupted after SMTP accepted the message. Keep the outcome visible and avoid a duplicate send.
  update workflow_email_deliveries d set state = 'uncertain', detail = 'Worker lost connection before recording the result', updated_at = now()
  where d.state = 'sending' and d.updated_at < now() - interval '5 minutes';

  return query
  with next_delivery as (
    select d.id, a.message, a.job_id, a.user_id, a.audience
    from workflow_email_deliveries d
    join workflow_alerts a on (a.event_id,a.user_id,a.audience) = (d.event_id,d.user_id,d.audience)
    where d.state = 'queued' and d.next_attempt_at <= now()
    order by d.next_attempt_at, d.id for update of d skip locked limit 1
  ), checked as (
    select n.*, j.number, case when u.email_confirmed_at is not null
      and exists (select 1 from workflow_email_preferences p where p.user_id = n.user_id and p.audience = n.audience)
      and ((n.audience = 'tenant' and j.requester_user_id = n.user_id and exists (
        select 1 from tenant_site_access a where a.user_id = n.user_id and a.site_id = j.site_id and a.can_request))
        or (n.audience = 'trade' and exists (
          select 1 from job_assignments a join members m on m.id = a.member_id
          where a.job_id = j.id and m.user_id = n.user_id and m.active and m.role in ('engineer','contractor'))))
      then u.email::text end as recipient
    from next_delivery n join jobs j on j.id = n.job_id join auth.users u on u.id = n.user_id
  )
  update workflow_email_deliveries d
  set state = case when c.recipient is null then 'skipped' else 'sending' end,
      detail = case when c.recipient is null then 'Email preference, verification or job access changed' end,
      attempts = d.attempts + case when c.recipient is null then 0 else 1 end,
      updated_at = now()
  from checked c where d.id = c.id
  returning d.id, c.recipient, c.number, c.audience, c.message, d.attempts;
end $$;

notify pgrst, 'reload schema';
