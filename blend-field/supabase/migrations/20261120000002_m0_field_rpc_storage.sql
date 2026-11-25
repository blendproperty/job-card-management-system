-- M0 backend: field writes go through security-definer functions (one transaction, stage rules
-- enforced in the database), storage policies for job photos/signatures.

alter table attachments add column content_type text;

-- Field users read events and attachments; they never write them directly.
drop policy job_rw on job_events;
create policy job_read on job_events for select using (assigned_to_me(job_id) or is_office(org_id));
drop policy job_rw on attachments;
create policy job_read on attachments for select using (assigned_to_me(job_id) or is_office(org_id));

create or replace function stage_label(s job_stage) returns text language sql immutable as $$
  select case s when 'unassigned' then 'unassigned' when 'assigned' then 'assigned' when 'en_route' then 'en route'
    when 'arrived' then 'arrived' when 'in_progress' then 'in progress' when 'pending' then 'pending'
    when 'completed' then 'completed' else 'cancelled' end $$;

-- ───────── office: assign / reassign ─────────
create or replace function assign_job(p_job uuid, p_members uuid[])
returns jobs language plpgsql security definer set search_path = public as $$
declare
  j jobs;
  actor_id uuid;
  valid uuid[];
  prev job_stage;
begin
  select * into j from jobs where id = p_job for update;
  if not found or not is_office(j.org_id) then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;
  if j.locked_at is not null then
    raise exception 'This job is completed and locked.' using errcode = 'P0001';
  end if;
  select array_agg(m.id order by array_position(p_members, m.id)) into valid
    from members m
   where m.id = any(p_members) and m.org_id = j.org_id and m.active and m.role in ('engineer','contractor');
  if valid is null then
    raise exception 'Pick someone to do the job.' using errcode = 'P0001';
  end if;
  select id into actor_id from members where user_id = auth.uid() and org_id = j.org_id;

  delete from job_assignments where job_id = p_job;
  insert into job_assignments (job_id, member_id, is_lead)
    select p_job, m, ord = 1 from unnest(valid) with ordinality as t(m, ord);

  prev := j.stage;
  update jobs set stage = case when stage = 'unassigned' then 'assigned'::job_stage else stage end
   where id = p_job returning * into j;
  insert into job_events (org_id, job_id, member_id, kind, from_stage, to_stage, payload, occurred_at)
    values (j.org_id, j.id, actor_id, 'assign', prev, j.stage, jsonb_build_object('member_ids', valid), now());
  return j;
end $$;
revoke all on function assign_job(uuid, uuid[]) from public, anon;
grant execute on function assign_job(uuid, uuid[]) to authenticated;

-- ───────── field: apply queued ops ─────────
-- ops: [{op_id, type:'status', job_id, to, occurred_at, lat?, lng?}
--       |{op_id, type:'attachment', job_id, attachment_id, kind, stage, taken_at, signer_name?, content_type, bytes}]
-- returns [{op_id, status: ok|duplicate|rejected, reason?}]
create or replace function field_apply_ops(p_ops jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  op jsonb;
  out jsonb := '[]'::jsonb;
  j jobs;
  actor_id uuid;
  to_s job_stage;
  at timestamptz;
  recv timestamptz := now();
  reason text;
  op_id uuid;
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

    j := null; actor_id := null; reason := null;
    select * into j from jobs where id = (op->>'job_id')::uuid for update;
    select m.id into actor_id from members m join job_assignments a on a.member_id = m.id
     where a.job_id = j.id and m.user_id = auth.uid() and m.active;

    if j.id is null or actor_id is null then
      reason := 'This job isn''t assigned to you any more.';
    elsif j.locked_at is not null then
      reason := 'This job is already completed.';
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
      if (j.stage, to_s) not in (('assigned','en_route'), ('en_route','arrived'), ('arrived','in_progress'),
                                 ('in_progress','completed'), ('in_progress','pending'), ('pending','in_progress')) then
        reason := format('This job is %s, so it can''t be marked %s. Pull to refresh.', stage_label(j.stage), stage_label(to_s));
      elsif to_s = 'completed' and not exists (select 1 from attachments where job_id = j.id and kind = 'photo') then
        reason := 'Add at least one photo.';
      elsif to_s = 'completed' and not exists (select 1 from attachments where job_id = j.id and kind = 'signature') then
        reason := 'Get the customer''s signature.';
      else
        at := least((op->>'occurred_at')::timestamptz, recv);  -- a fast phone clock can't write the future
        insert into job_events (org_id, job_id, member_id, client_op_id, kind, from_stage, to_stage, lat, lng, occurred_at, received_at)
        values (j.org_id, j.id, actor_id, op_id, 'status', j.stage, to_s,
                nullif(op->>'lat','')::float8, nullif(op->>'lng','')::float8, at, recv);
        update jobs set
          stage = to_s,
          arrived_at = case when to_s = 'arrived' then at else arrived_at end,
          started_at = case when to_s = 'in_progress' and started_at is null then at else started_at end,
          completed_at = case when to_s = 'completed' then at else completed_at end,
          locked_at = case when to_s = 'completed' then recv else locked_at end,
          on_site_seconds = case when to_s = 'completed' and arrived_at is not null
                                 then greatest(0, extract(epoch from at - arrived_at))::int else on_site_seconds end
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

-- ───────── storage: job-files bucket ─────────
-- Object path: <org_id>/<job_id>/<attachment_id>.<ext>. Upload allowed only for a recorded,
-- not-yet-uploaded attachment on a job assigned to the uploader. Objects are immutable.
create policy job_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-files'
  and exists (
    select 1 from public.attachments a
     where a.id::text = split_part(storage.filename(name), '.', 1)
       and a.job_id::text = (storage.foldername(name))[2]
       and a.org_id::text = (storage.foldername(name))[1]
       and a.uploaded_at is null
       and public.assigned_to_me(a.job_id)
  )
);

create policy job_files_read on storage.objects for select to authenticated
using (
  bucket_id = 'job-files'
  and exists (
    select 1 from public.attachments a
     where a.id::text = split_part(storage.filename(name), '.', 1)
       and a.job_id::text = (storage.foldername(name))[2]
       and (public.is_office(a.org_id) or public.assigned_to_me(a.job_id))
  )
);

-- Called after the bytes land; confirms the object exists before marking the attachment uploaded.
create or replace function field_mark_uploaded(p_attachment uuid, p_path text)
returns attachments language plpgsql security definer set search_path = public as $$
declare a attachments; obj_size bigint;
begin
  select * into a from attachments where id = p_attachment for update;
  if not found or not assigned_to_me(a.job_id) then
    raise exception 'Attachment not found.' using errcode = 'P0002';
  end if;
  if p_path <> a.org_id || '/' || a.job_id || '/' || a.id || '.' || split_part(p_path, '.', 2) then
    raise exception 'Wrong path.' using errcode = '22023';
  end if;
  select (metadata->>'size')::bigint into obj_size from storage.objects where bucket_id = 'job-files' and name = p_path;
  if not found then
    raise exception 'Upload not found.' using errcode = 'P0002';
  end if;
  update attachments set storage_path = p_path, bytes = obj_size, uploaded_at = now()
   where id = p_attachment returning * into a;
  return a;
end $$;
revoke all on function field_mark_uploaded(uuid, text) from public, anon;
grant execute on function field_mark_uploaded(uuid, text) to authenticated;

-- The anon role gets nothing in public: every table is RLS-protected and has no anon policies.
revoke all on all tables in schema public from anon;
