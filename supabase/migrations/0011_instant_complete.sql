-- Instant briefs come with several options; picking one shouldn't mean reviewing them all first.
create or replace function public.complete_project(p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype;
begin
  select * into v from public.projects where id = p_project for update;
  if not found or not public.can_edit_org(v.org_id) then raise exception 'Project not found.' using errcode = '42501'; end if;
  if v.status not in ('in_review', 'in_progress', 'changes_requested') then
    raise exception 'This project can''t be completed from its current stage.' using errcode = '22023';
  end if;
  if v.kind <> 'instant' and exists (select 1 from public.deliverables where project_id = p_project and status = 'in_review') then
    raise exception 'Review every file before completing the project.' using errcode = '22023';
  end if;
  update public.projects set status = 'completed', completed_at = now() where id = p_project;
  perform public.promote_queue(v.org_id);
end $$;
revoke execute on function public.complete_project(uuid) from public, anon;
grant execute on function public.complete_project(uuid) to authenticated;
