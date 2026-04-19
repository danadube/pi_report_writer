-- Phase 0–2: extraction generation counter, delete RPC fix (emails), extracted_emails table if missing,
-- draft version / items / events / final snapshots (Supabase SQL — apply via supabase db push / Dashboard).

-- ─── extracted_emails (reconcile drift if table was only created manually) ─────
create table if not exists public.extracted_emails (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.reports(id) on delete cascade,
  source_id           uuid references public.report_sources(id) on delete set null,
  email               text not null default '',
  confidence          integer,
  subject_index       integer,
  include_in_report   boolean not null default true
);

create index if not exists extracted_emails_report_id_idx on public.extracted_emails (report_id);
create index if not exists extracted_emails_source_id_idx on public.extracted_emails (source_id);

alter table public.extracted_emails enable row level security;

drop policy if exists "users can manage extracted emails for their reports" on public.extracted_emails;
create policy "users can manage extracted emails for their reports"
  on public.extracted_emails for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

-- ─── reports.extraction_generation ─────────────────────────────────────────────
alter table public.reports
  add column if not exists extraction_generation bigint not null default 1;

comment on column public.reports.extraction_generation is
  'Monotonic counter bumped when structured extraction for any source is successfully replaced; used to mark draft versions stale vs current extraction.';

update public.reports set extraction_generation = 1 where extraction_generation is null;

-- ─── RPC: increment generation after successful replace ──────────────────────
create or replace function public.increment_report_extraction_generation(p_report_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v bigint;
begin
  update public.reports
  set extraction_generation = coalesce(extraction_generation, 1) + 1,
      updated_at = now()
  where id = p_report_id
  returning extraction_generation into v;
  return v;
end;
$$;

comment on function public.increment_report_extraction_generation(uuid) is
  'Atomically increments reports.extraction_generation after a successful extracted_* replace for a source.';

grant execute on function public.increment_report_extraction_generation(uuid) to authenticated;
grant execute on function public.increment_report_extraction_generation(uuid) to service_role;

-- ─── RPC: delete_extracted_for_source — include extracted_emails ─────────────
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

comment on function public.delete_extracted_for_source(uuid, uuid) is
  'Removes all extracted_* rows for a report source in one transaction (replace-on-rerun safety).';

-- ─── Draft enums ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.draft_version_status as enum (
    'draft', 'active', 'stale', 'finalized', 'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.draft_item_scope as enum ('subject', 'report');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.draft_item_state as enum ('included', 'excluded', 'review_needed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.draft_item_origin as enum ('candidate', 'manual', 'system_warning');
exception
  when duplicate_object then null;
end $$;

-- ─── report_draft_versions ───────────────────────────────────────────────────
create table if not exists public.report_draft_versions (
  id                         uuid primary key default gen_random_uuid(),
  report_id                  uuid not null references public.reports(id) on delete cascade,
  version_number             integer not null,
  title                      text not null default '',
  status                     public.draft_version_status not null default 'draft',
  based_on_draft_version_id  uuid references public.report_draft_versions(id) on delete set null,
  extraction_generation      bigint not null default 1,
  has_blocking_warnings      boolean not null default false,
  created_by                 uuid not null references auth.users(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  finalized_at               timestamptz,
  stale_reason               text,
  unique (report_id, version_number)
);

create unique index if not exists report_draft_versions_one_active_per_report
  on public.report_draft_versions (report_id)
  where status = 'active';

create index if not exists report_draft_versions_report_id_idx
  on public.report_draft_versions (report_id);

alter table public.report_draft_versions enable row level security;

drop policy if exists "users manage draft versions for own reports" on public.report_draft_versions;
create policy "users manage draft versions for own reports"
  on public.report_draft_versions for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  )
  with check (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

drop trigger if exists report_draft_versions_updated_at on public.report_draft_versions;
create trigger report_draft_versions_updated_at
  before update on public.report_draft_versions
  for each row execute procedure public.set_updated_at();

-- ─── report_draft_items ──────────────────────────────────────────────────────
create table if not exists public.report_draft_items (
  id                 uuid primary key default gen_random_uuid(),
  draft_version_id   uuid not null references public.report_draft_versions(id) on delete cascade,
  scope              public.draft_item_scope not null,
  subject_index      integer,
  section_key        text not null,
  entity_kind        text not null,
  state              public.draft_item_state not null default 'included',
  origin_type        public.draft_item_origin not null,
  display_payload    jsonb not null,
  source_ref_payload jsonb,
  sort_order         integer not null default 0,
  review_reason      text,
  user_note          text,
  created_by         uuid not null references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint report_draft_items_scope_subject_ck check (
    (scope = 'subject' and subject_index is not null)
    or (scope = 'report' and subject_index is null)
  )
);

create index if not exists report_draft_items_draft_version_id_idx
  on public.report_draft_items (draft_version_id);

alter table public.report_draft_items enable row level security;

drop policy if exists "users manage draft items for own reports" on public.report_draft_items;
create policy "users manage draft items for own reports"
  on public.report_draft_items for all
  using (
    draft_version_id in (
      select v.id from public.report_draft_versions v
      join public.reports r on r.id = v.report_id
      where r.created_by_user_id = auth.uid()
    )
  )
  with check (
    draft_version_id in (
      select v.id from public.report_draft_versions v
      join public.reports r on r.id = v.report_id
      where r.created_by_user_id = auth.uid()
    )
  );

drop trigger if exists report_draft_items_updated_at on public.report_draft_items;
create trigger report_draft_items_updated_at
  before update on public.report_draft_items
  for each row execute procedure public.set_updated_at();

-- ─── report_draft_events ───────────────────────────────────────────────────────
create table if not exists public.report_draft_events (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.reports(id) on delete cascade,
  draft_version_id  uuid references public.report_draft_versions(id) on delete set null,
  draft_item_id     uuid references public.report_draft_items(id) on delete set null,
  event_type        text not null,
  payload           jsonb not null default '{}'::jsonb,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists report_draft_events_report_id_idx on public.report_draft_events (report_id);
create index if not exists report_draft_events_draft_version_id_idx on public.report_draft_events (draft_version_id);

alter table public.report_draft_events enable row level security;

drop policy if exists "users read draft events for own reports" on public.report_draft_events;
create policy "users read draft events for own reports"
  on public.report_draft_events for select
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

drop policy if exists "users insert draft events for own reports" on public.report_draft_events;
create policy "users insert draft events for own reports"
  on public.report_draft_events for insert
  with check (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

-- ─── report_final_snapshots (schema placeholder) ───────────────────────────
create table if not exists public.report_final_snapshots (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.reports(id) on delete cascade,
  draft_version_id  uuid not null references public.report_draft_versions(id) on delete restrict,
  snapshot_payload  jsonb not null,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists report_final_snapshots_report_id_idx on public.report_final_snapshots (report_id);

alter table public.report_final_snapshots enable row level security;

drop policy if exists "users manage final snapshots for own reports" on public.report_final_snapshots;
create policy "users manage final snapshots for own reports"
  on public.report_final_snapshots for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  )
  with check (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );
