create or replace function public.is_office(p_org uuid) returns boolean language sql stable as $$
  select coalesce(public.my_role(p_org) in ('admin','office','facility_manager'), false)
$$;

create or replace function field_apply_ops(p_ops jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  op jsonb;
  out jsonb := '[]'::jsonb;
  j jobs;
  r resolutions;
  actor_id uuid;
  to_s job_stage;
  at timestamptz;
  recv timestamptz := now();
  reason text;
  op_id uuid;
  comment text;
begin
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) > 200 then
    raise exception 'Send 1 to 200 ops.' using errcode = '22023';
  end if;

  for op in select value from jsonb_array_elements(p_ops) loop
    op_id := (op->>'op_id')::uuid;

    if exists (select 1 from job_events where client_op_id = op_id)
       or (op->>'type' = 'attachment' and exists (select 1 from attachments where id = (op->>'attachment_id')::uuid)) then
      out := out || jsonb_build_object('op_id', op_id, 'status', 'duplicate');
      continue;
    end if;

    j := null; actor_id := null; reason := null; r := null;
    select * into j from jobs where id = (op->>'job_id')::uuid for update;
    select m.id into actor_id from members m join job_assignments a on a.member_id = m.id
     where a.job_id = j.id and m.user_id = auth.uid() and m.active;

    if j.id is null or actor_id is null then
      reason := 'This job isn''t assigned to you any more.';
    elsif j.locked_at is not null and op->>'type' <> 'follow_up' then
      reason := 'This job is already completed.';
    end if;

    -- follow-up request: a note for the office
    if reason is null and op->>'type' = 'follow_up' then
      insert into job_events (org_id, job_id, member_id, client_op_id, kind, payload, occurred_at, received_at)
      values (j.org_id, j.id, actor_id, op_id, 'note',
              jsonb_build_object('follow_up_requested', true, 'note', nullif(trim(left(op->>'note', 500)), '')),
              least((op->>'occurred_at')::timestamptz, recv), recv);
      out := out || jsonb_build_object('op_id', op_id, 'status', 'ok');
      continue;
    end if;

    if reason is null and op->>'type' = 'attachment' then
      if op->>'kind' not in ('photo','signature') or op->>'stage' not in ('before','during','after','other') then
        reason := 'Unknown attachment type.';
      else
        insert into attachments (id, org_id, job_id, kind, stage, content_type, bytes, signer_name, taken_at, created_by)
        values ((op->>'attachment_id')::uuid, j.org_id, j.id, (op->>'kind')::attachment_kind, (op->>'stage')::attachment_stage,
                op->>'content_type', nullif(op->>'bytes','')::int,
                case when op->>'kind' = 'signature' then nullif(trim(left(op->>'signer_name', 120)), '') end,
                least((op->>'taken_at')::timestamptz, recv), actor_id);
        insert into job_events (org_id, job_id, member_id, client_op_id, kind, payload, occurred_at, received_at)
        values (j.org_id, j.id, actor_id, op_id, 'note',
                jsonb_build_object('attachment_id', op->>'attachment_id', 'kind', op->>'kind', 'stage', op->>'stage'),
                least((op->>'taken_at')::timestamptz, recv), recv);
        out := out || jsonb_build_object('op_id', op_id, 'status', 'ok');
        continue;
      end if;
    end if;

    if reason is null and op->>'type' = 'status' then
      to_s := (op->>'to')::job_stage;
      comment := nullif(trim(left(op->>'resolution_comment', 1000)), '');
      if (j.stage, to_s) not in (('assigned','en_route'), ('en_route','arrived'), ('arrived','in_progress'),
                                 ('in_progress','completed'), ('in_progress','pending'), ('pending','in_progress')) then
        reason := format('This job is %s, so it can''t be marked %s. Pull to refresh.', stage_label(j.stage), stage_label(to_s));
      elsif to_s = 'completed' then
        if nullif(op->>'resolution_id', '') is null then
          reason := 'Choose how the job went.';
        else
          select * into r from resolutions where id = (op->>'resolution_id')::uuid and org_id = j.org_id;
          if r.id is null or r.archived then
            reason := 'That outcome is no longer available. Pull to refresh.';
          elsif j.job_type_id is not null
                and exists (select 1 from job_type_resolutions where job_type_id = j.job_type_id)
                and not exists (select 1 from job_type_resolutions where job_type_id = j.job_type_id and resolution_id = r.id) then
            reason := format('"%s" isn''t an outcome for this type of job.', r.name);
          elsif r.requires_comment and comment is null then
            reason := format('Add a comment for "%s".', r.name);
          elsif r.successful and not exists (select 1 from attachments where job_id = j.id and kind = 'photo') then
            reason := 'Add at least one photo.';
          elsif r.successful and not exists (select 1 from attachments where job_id = j.id and kind = 'signature') then
            reason := 'Get the customer''s signature.';
          end if;
        end if;
      end if;

      if reason is null and to_s = 'completed' and j.trade is not null then
        if jsonb_typeof(op->'work_minutes') is distinct from 'number'
           or coalesce(op->>'work_minutes','') !~ '^[0-9]{1,5}$'
           or jsonb_typeof(op->'overtime_minutes') is distinct from 'number'
           or coalesce(op->>'overtime_minutes','') !~ '^[0-9]{1,5}$'
           or op->'worker_signed' is distinct from 'true'::jsonb then
          reason := 'Record work time and confirm your sign-off.';
        elsif (op->>'work_minutes')::int > 10080 or (op->>'overtime_minutes')::int > (op->>'work_minutes')::int then
          reason := 'Overtime must be within total work time, up to seven days.';
        elsif r.successful and (
          not exists (select 1 from attachments where job_id = j.id and kind = 'photo' and stage = 'before' and uploaded_at is not null)
          or not exists (select 1 from attachments where job_id = j.id and kind = 'photo' and stage = 'after' and uploaded_at is not null)
          or not exists (select 1 from attachments where job_id = j.id and kind = 'signature' and uploaded_at is not null)
        ) then
          reason := 'Upload before and after photos and a customer signature before completing.';
        end if;
      end if;

      if reason is null then
        at := least((op->>'occurred_at')::timestamptz, recv);
        insert into job_events (org_id, job_id, member_id, client_op_id, kind, from_stage, to_stage, payload, lat, lng, occurred_at, received_at)
        values (j.org_id, j.id, actor_id, op_id, 'status', j.stage, to_s,
                case when r.id is null then '{}'::jsonb else jsonb_build_object(
                  'resolution_id', r.id, 'resolution_name', r.name, 'successful', r.successful, 'comment', comment) ||
                  case when j.trade is not null then jsonb_build_object(
                    'work_minutes', (op->>'work_minutes')::int,
                    'overtime_minutes', (op->>'overtime_minutes')::int,
                    'worker_signed', true) else '{}'::jsonb end end,
                nullif(op->>'lat','')::float8, nullif(op->>'lng','')::float8, at, recv);
        update jobs set
          stage = to_s,
          arrived_at = case when to_s = 'arrived' then at else arrived_at end,
          started_at = case when to_s = 'in_progress' and started_at is null then at else started_at end,
          completed_at = case when to_s = 'completed' then at else completed_at end,
          locked_at = case when to_s = 'completed' then recv else locked_at end,
          on_site_seconds = case when to_s = 'completed' and arrived_at is not null
                                 then greatest(0, extract(epoch from at - arrived_at))::int else on_site_seconds end,
          resolution_id = case when to_s = 'completed' then r.id else resolution_id end,
          resolution_comment = case when to_s = 'completed' then comment else resolution_comment end
        where id = j.id;
        out := out || jsonb_build_object('op_id', op_id, 'status', 'ok');
        continue;
      end if;
    elsif reason is null then
      reason := 'Unknown change type.';
    end if;

    out := out || jsonb_build_object('op_id', op_id, 'status', 'rejected', 'reason', reason);
  end loop;
  return out;
end $$;
revoke all on function field_apply_ops(jsonb) from public, anon;
grant execute on function field_apply_ops(jsonb) to authenticated;

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
    if p_decision = 'approve' then
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
revoke all on function public.review_job(uuid,text) from public, anon;
grant execute on function public.review_job(uuid,text) to authenticated;
notify pgrst, 'reload schema';


-- The shared location must belong to the worker's active membership in this organisation.
drop policy self_write on public.member_locations;
create policy self_write on public.member_locations for all to authenticated
using (exists (select 1 from public.members m where m.id = member_id and m.org_id = member_locations.org_id
  and m.user_id = auth.uid() and m.active and m.role in ('engineer','contractor')))
with check (lat between -90 and 90 and lng between -180 and 180
  and exists (select 1 from public.members m where m.id = member_id and m.org_id = member_locations.org_id
    and m.user_id = auth.uid() and m.active and m.role in ('engineer','contractor')));
