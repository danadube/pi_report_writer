-- Atomic delete of all structured rows for one source (avoids partial wipes if one DELETE fails mid-loop).

create or replace function public.delete_extracted_for_source(p_report_id uuid, p_source_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.extracted_employment
    where report_id = p_report_id and source_id = p_source_id;
  delete from public.extracted_associates
    where report_id = p_report_id and source_id = p_source_id;
  delete from public.extracted_vehicles
    where report_id = p_report_id and source_id = p_source_id;
  delete from public.extracted_phones
    where report_id = p_report_id and source_id = p_source_id;
  delete from public.extracted_addresses
    where report_id = p_report_id and source_id = p_source_id;
  delete from public.extracted_people
    where report_id = p_report_id and source_id = p_source_id;
end;
$$;

comment on function public.delete_extracted_for_source(uuid, uuid) is
  'Removes all extracted_* rows for a report source in one transaction (replace-on-rerun safety).';

grant execute on function public.delete_extracted_for_source(uuid, uuid) to authenticated;
grant execute on function public.delete_extracted_for_source(uuid, uuid) to service_role;
