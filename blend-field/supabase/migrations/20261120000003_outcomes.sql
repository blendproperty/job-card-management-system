-- Job outcomes (resolutions), from the Planado merge in replica/ramtracking/schema.sql.
-- A completed job always has an outcome; photo + signature are required only for successful ones.

create table resolutions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  successful boolean not null,
  requires_comment boolean not null default false,
  suggest_follow_up boolean not null default false,
  sort integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);
create trigger resolutions_touch before update on resolutions for each row execute function touch_updated_at();

create table job_type_resolutions (          -- which outcomes a job type offers; none listed = all
  job_type_id uuid not null references job_types(id) on delete cascade,
  resolution_id uuid not null references resolutions(id) on delete cascade,
  primary key (job_type_id, resolution_id)
);
create index on job_type_resolutions (resolution_id);

alter table jobs
  add column resolution_id uuid references resolutions(id) on delete restrict,
  add column resolution_comment text;
create index on jobs (resolution_id);
alter table jobs add constraint completed_has_outcome check (stage <> 'completed' or resolution_id is not null);

alter table resolutions enable row level security;
alter table job_type_resolutions enable row level security;
create policy office_all on resolutions for all using (is_office(org_id)) with check (is_office(org_id));
create policy org_read on resolutions for select using (org_id in (select my_org_ids()));
create policy org_read on job_type_resolutions for select
  using (exists (select 1 from job_types jt where jt.id = job_type_id and jt.org_id in (select my_org_ids())));
revoke all on resolutions, job_type_resolutions from anon;

-- Default outcomes for an org (used by the seed; M2's org setup calls it too).
create or replace function seed_default_resolutions(p_org uuid) returns void language sql as $$
  insert into resolutions (org_id, name, successful, requires_comment, suggest_follow_up, sort) values
    (p_org, 'Fixed', true, false, false, 10),
    (p_org, 'Inspected, no fault', true, false, false, 20),
    (p_org, 'Tenant not home', false, true, true, 30),
    (p_org, 'No access', false, true, true, 40),
    (p_org, 'Parts on order', false, false, true, 50),
    (p_org, 'Quote needed', false, false, false, 60)
  on conflict (org_id, name) do nothing $$;
revoke all on function seed_default_resolutions(uuid) from public, anon, authenticated;

-- ───────── field ops, now with outcomes ─────────
-- status op to 'completed' carries resolution_id and resolution_comment.
-- new op type 'follow_up': {op_id, type, job_id, note?, occurred_at}. Append-only note for the office,
-- allowed on a completed job (it doesn't change the job). Follow-up jobs themselves arrive in M2.
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

      if reason is null then
        at := least((op->>'occurred_at')::timestamptz, recv);
        insert into job_events (org_id, job_id, member_id, client_op_id, kind, from_stage, to_stage, payload, lat, lng, occurred_at, received_at)
        values (j.org_id, j.id, actor_id, op_id, 'status', j.stage, to_s,
                case when r.id is null then '{}'::jsonb else jsonb_build_object(
                  'resolution_id', r.id, 'resolution_name', r.name, 'successful', r.successful, 'comment', comment) end,
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
