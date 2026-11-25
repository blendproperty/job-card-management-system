create table public.workflow_email_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience in ('tenant','trade')),
  primary key (user_id, audience)
);
alter table public.workflow_email_preferences enable row level security;
revoke all on public.workflow_email_preferences from public, anon, authenticated;

create function public.workflow_email_enabled(p_audience text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from workflow_email_preferences where user_id = auth.uid() and audience = p_audience)
$$;

create function public.set_workflow_email(p_audience text, p_enabled boolean) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or p_enabled is null or p_audience is null or p_audience not in ('tenant','trade') then
    raise exception 'Invalid notification preference.';
  end if;
  if not p_enabled then
    delete from workflow_email_preferences where user_id = auth.uid() and audience = p_audience;
  elsif (p_audience = 'tenant' and exists (select 1 from tenant_site_access where user_id = auth.uid()))
    or (p_audience = 'trade' and exists (select 1 from members where user_id = auth.uid() and active and role in ('engineer','contractor'))) then
    insert into workflow_email_preferences(user_id, audience) values (auth.uid(), p_audience) on conflict do nothing;
  else
    raise exception 'This account is not eligible for that preference.';
  end if;
  return p_enabled;
end $$;
revoke all on function public.workflow_email_enabled(text), public.set_workflow_email(text,boolean) from public, anon, authenticated;
grant execute on function public.workflow_email_enabled(text), public.set_workflow_email(text,boolean) to authenticated;

create table public.workflow_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  user_id uuid not null,
  audience text not null,
  state text not null default 'queued' check (state in ('queued','sending','accepted','failed','uncertain','skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  detail text,
  foreign key (event_id,user_id,audience) references public.workflow_alerts(event_id,user_id,audience) on delete cascade,
  unique (event_id,user_id,audience)
);
create index on public.workflow_email_deliveries (next_attempt_at,id) where state = 'queued';
alter table public.workflow_email_deliveries enable row level security;
revoke all on public.workflow_email_deliveries from public, anon, authenticated;

create function public.enqueue_workflow_email() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into workflow_email_deliveries(event_id,user_id,audience)
  select new.event_id,new.user_id,new.audience
  from workflow_email_preferences p join auth.users u on u.id = p.user_id
  where p.user_id = new.user_id and p.audience = new.audience
    and u.email is not null and u.email_confirmed_at is not null
  on conflict do nothing;
  return new;
end $$;
revoke all on function public.enqueue_workflow_email() from public, anon, authenticated;
create trigger queue_job_notification_email after insert on public.workflow_alerts
for each row execute function public.enqueue_workflow_email();

create function public.claim_workflow_email()
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
        select 1 from tenant_site_access a where a.user_id = n.user_id and a.site_id = j.site_id))
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

create function public.finish_workflow_email(p_id uuid, p_attempt integer, p_outcome text, p_detail text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_outcome is null or p_outcome not in ('accepted','retry','failed','uncertain') then raise exception 'Invalid delivery result.'; end if;
  update workflow_email_deliveries d
  set state = case when p_outcome = 'retry' then case when attempts < 4 then 'queued' else 'failed' end else p_outcome end,
      next_attempt_at = now() + interval '1 minute' * power(2, attempts - 1),
      detail = left(p_detail, 100), updated_at = now()
  where d.id = p_id and d.state = 'sending' and d.attempts = p_attempt;
  return found;
end $$;

create role workflow_email_sender nologin;
grant usage on schema public to workflow_email_sender;
revoke all on function public.claim_workflow_email(), public.finish_workflow_email(uuid,integer,text,text) from public, anon, authenticated;
grant execute on function public.claim_workflow_email(), public.finish_workflow_email(uuid,integer,text,text) to workflow_email_sender;

create function public.office_workflow_emails(p_job uuid)
returns table(id uuid, audience text, message text, state text, attempts integer, updated_at timestamptz, detail text)
language sql stable security definer set search_path = public, pg_temp as $$
  select d.id, d.audience, a.message, d.state, d.attempts, d.updated_at, d.detail
  from workflow_email_deliveries d
  join workflow_alerts a on (a.event_id,a.user_id,a.audience) = (d.event_id,d.user_id,d.audience)
  join jobs j on j.id = a.job_id
  where j.id = p_job and is_office(j.org_id)
  order by d.updated_at desc, d.id desc limit 30
$$;
revoke all on function public.office_workflow_emails(uuid) from public, anon, authenticated;
grant execute on function public.office_workflow_emails(uuid) to authenticated;
notify pgrst, 'reload schema';
