-- Job inserts already apply organisation RLS; updating the counter should not grant write access to the organisation.
create or replace function public.assign_job_number() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update orgs set next_job_number = next_job_number + 1
   where id = new.org_id returning next_job_number - 1 into new.number;
  return new;
end $$;
revoke all on function public.assign_job_number() from public, anon, authenticated;
