alter table public.jobs add column trade text check (trade in ('general maintenance','plumbing','electrical','other'));
alter table public.jobs add column preferred_worker uuid references public.members(id) on delete set null;

-- Enforce the approval gate at both assignment entry points.
create function public.require_dispatch_approval() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if exists (select 1 from jobs where id = new.job_id and approval in ('awaiting','rejected')) then
    raise exception 'Approve this request before allocating work.';
  end if;
  return new;
end;
$$;
create trigger assignment_approval before insert or update on public.job_assignments
for each row execute function public.require_dispatch_approval();

create function public.protect_dispatch_approval() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user = 'authenticated' and (old.trade is not null or new.trade is not null)
    and (new.approval is distinct from old.approval or new.trade is distinct from old.trade) then
    raise exception 'Use the request approval action.';
  end if;
  if new.trade is not null and new.approval in ('awaiting','rejected') and new.stage <> 'unassigned' then
    raise exception 'Approve this request before moving it to another stage.';
  end if;
  return new;
end;
$$;
create trigger job_dispatch_approval before update on public.jobs
for each row execute function public.protect_dispatch_approval();
alter table public.jobs add constraint trade_requires_review check (trade is null or approval <> 'not_required');

create function public.review_job(p_job uuid, p_decision text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j jobs;
  actor members;
  worker uuid;
begin
  select * into j from jobs where id = p_job for update;
  if not found then raise exception 'Job not found.' using errcode = 'P0002'; end if;
  select * into actor from members where user_id = auth.uid() and org_id = j.org_id and active;
  if not found or actor.role not in ('admin','office') then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if p_decision = 'close' then
    if actor.role <> 'admin' or j.stage <> 'completed' then
      raise exception 'An administrator can close the job after field completion.';
    end if;
    if exists (select 1 from job_events where job_id = p_job and payload->>'review' = 'close') then
      return;
    end if;
    if exists (select 1 from resolutions where id = j.resolution_id and successful) and (
      not exists (select 1 from attachments where job_id = p_job and kind = 'photo' and stage = 'before' and uploaded_at is not null)
      or not exists (select 1 from attachments where job_id = p_job and kind = 'photo' and stage = 'after' and uploaded_at is not null)
      or not exists (select 1 from attachments where job_id = p_job and kind = 'signature' and uploaded_at is not null)
    ) then raise exception 'Closure requires uploaded before and after photos and a customer signature.'; end if;
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
  values (j.org_id, j.id, actor.id, 'approval', jsonb_build_object('review', p_decision), now());
end;
$$;
revoke all on function public.review_job(uuid,text) from public, anon;
grant execute on function public.review_job(uuid,text) to authenticated;
notify pgrst, 'reload schema';
