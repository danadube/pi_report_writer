-- Emails from TLO-style sources; subject columns for primary vs alternate TLO subjects.

create table public.extracted_emails (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.reports(id) on delete cascade,
  source_id         uuid references public.report_sources(id) on delete set null,
  email             text not null default '',
  confidence        integer,
  include_in_report boolean not null default true
);

comment on table public.extracted_emails is 'Email addresses extracted from source documents (e.g. TLO).';
comment on column public.extracted_emails.confidence is 'Match confidence 0–100 when provided by source.';

alter table public.extracted_people
  add column if not exists subject_index integer,
  add column if not exists is_primary_subject boolean not null default true;

comment on column public.extracted_people.subject_index is '1-based TLO subject slot when known (Subject 1 of 2 → 1).';
comment on column public.extracted_people.is_primary_subject is 'True when this row is the investigation primary (typically Subject 1).';

alter table public.extracted_emails enable row level security;

create policy "users can manage extracted emails for their reports"
  on public.extracted_emails for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

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
  delete from public.extracted_emails
    where report_id = p_report_id and source_id = p_source_id;
  delete from public.extracted_phones
    where report_id = p_report_id and source_id = p_source_id;
  delete from public.extracted_addresses
    where report_id = p_report_id and source_id = p_source_id;
  delete from public.extracted_people
    where report_id = p_report_id and source_id = p_source_id;
end;
$$;
