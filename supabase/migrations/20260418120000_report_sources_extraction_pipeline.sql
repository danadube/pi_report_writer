-- Phase 1: track extraction pipeline state on report_sources (no Prisma — apply via Supabase CLI or Dashboard SQL).

alter table public.report_sources
  add column if not exists extraction_status text not null default 'pending';

alter table public.report_sources
  add column if not exists extraction_error text;

alter table public.report_sources
  drop constraint if exists report_sources_extraction_status_check;

alter table public.report_sources
  add constraint report_sources_extraction_status_check
  check (extraction_status in ('pending', 'running', 'complete', 'failed'));

comment on column public.report_sources.extraction_status is 'Extraction pipeline: pending → running → complete | failed';
comment on column public.report_sources.extraction_error is 'Last extraction failure message, if any';
