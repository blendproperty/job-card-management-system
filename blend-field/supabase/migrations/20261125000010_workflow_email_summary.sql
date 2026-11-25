create function public.claim_workflow_email_summary()
returns table (
  id uuid, email text, number integer, audience text, message text, attempt integer,
  title text, property text, trade text, status text, starts_sast text, ends_sast text
)
language sql volatile security definer set search_path = public, pg_temp as $$
  select c.id, c.email, c.number, c.audience, c.message, c.attempt,
    j.title, s.label, initcap(j.trade),
    case when j.id is null then null
         when j.approval = 'rejected' then 'Declined'
         when j.approval = 'awaiting' then 'Awaiting approval'
         when exists (select 1 from job_events e where e.job_id = j.id and e.payload->>'review' = 'close') then 'Closed'
         when j.stage = 'completed' then 'Awaiting final review'
         else initcap(replace(j.stage::text, '_', ' ')) end,
    to_char(j.scheduled_start at time zone 'Africa/Johannesburg', 'FMDD Mon YYYY, HH24:MI'),
    to_char(j.scheduled_end at time zone 'Africa/Johannesburg', 'FMDD Mon YYYY, HH24:MI')
  from claim_workflow_email() c
  left join workflow_email_deliveries d on d.id = c.id and c.email is not null
  left join workflow_alerts a on (a.event_id, a.user_id, a.audience) = (d.event_id, d.user_id, d.audience)
  left join jobs j on j.id = a.job_id
  left join sites s on s.id = j.site_id
$$;

revoke all on function public.claim_workflow_email_summary() from public, anon, authenticated;
grant execute on function public.claim_workflow_email_summary() to workflow_email_sender;
