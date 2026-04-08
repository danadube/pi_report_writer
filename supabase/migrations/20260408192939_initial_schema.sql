-- ─────────────────────────────────────────────────────────────────────────────
-- PI Report Writer — Initial Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enum types ───────────────────────────────────────────────────────────────

create type public.report_type as enum (
  'BACKGROUND_INVESTIGATION',
  'SURVEILLANCE'
);

create type public.report_status as enum (
  'DRAFT',
  'FINAL',
  'ARCHIVED'
);

create type public.source_document_type as enum (
  'TLO_COMPREHENSIVE',
  'DMV_RECORDS',
  'MANUAL_ENTRY',
  'OTHER'
);

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,
  created_at  timestamptz not null default now()
);

create table public.user_profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  name             text not null default '',
  email            text not null default '',
  organization_id  uuid references public.organizations(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table public.reports (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid references public.organizations(id) on delete set null,
  created_by_user_id      uuid not null references auth.users(id) on delete cascade,
  report_type             public.report_type not null,
  status                  public.report_status not null default 'DRAFT',
  case_name               text not null default '',
  client_name             text not null default '',
  investigator_name       text not null default '',
  subject_name            text not null default '',
  report_date             date,
  summary_notes           text,
  generated_report_html   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.report_sources (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.reports(id) on delete cascade,
  source_type     public.source_document_type not null,
  file_name       text not null default '',
  file_url        text not null default '',
  extracted_text  text,
  created_at      timestamptz not null default now()
);

create table public.extracted_people (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.reports(id) on delete cascade,
  source_id           uuid references public.report_sources(id) on delete set null,
  full_name           text not null default '',
  dob                 text,
  aliases             text[] not null default '{}',
  include_in_report   boolean not null default true
);

create table public.extracted_addresses (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.reports(id) on delete cascade,
  source_id           uuid references public.report_sources(id) on delete set null,
  label               text,
  street              text not null default '',
  city                text not null default '',
  state               text not null default '',
  zip                 text not null default '',
  date_range_text     text,
  include_in_report   boolean not null default true
);

create table public.extracted_phones (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.reports(id) on delete cascade,
  source_id           uuid references public.report_sources(id) on delete set null,
  phone_number        text not null default '',
  phone_type          text,
  include_in_report   boolean not null default true
);

create table public.extracted_vehicles (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.reports(id) on delete cascade,
  source_id           uuid references public.report_sources(id) on delete set null,
  year                text,
  make                text,
  model               text,
  vin                 text,
  plate               text,
  state               text,
  include_in_report   boolean not null default true
);

create table public.extracted_associates (
  id                   uuid primary key default gen_random_uuid(),
  report_id            uuid not null references public.reports(id) on delete cascade,
  source_id            uuid references public.report_sources(id) on delete set null,
  name                 text not null default '',
  relationship_label   text,
  include_in_report    boolean not null default true
);

create table public.extracted_employment (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.reports(id) on delete cascade,
  source_id           uuid references public.report_sources(id) on delete set null,
  employer_name       text not null default '',
  role_title          text,
  include_in_report   boolean not null default true
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_sources enable row level security;
alter table public.extracted_people enable row level security;
alter table public.extracted_addresses enable row level security;
alter table public.extracted_phones enable row level security;
alter table public.extracted_vehicles enable row level security;
alter table public.extracted_associates enable row level security;
alter table public.extracted_employment enable row level security;

-- organizations: members can view their own org
create policy "org members can view their org"
  on public.organizations for select
  using (
    id in (
      select organization_id from public.user_profiles
      where id = auth.uid()
    )
  );

-- user_profiles
create policy "users can view their own profile"
  on public.user_profiles for select
  using (id = auth.uid());

create policy "users can update their own profile"
  on public.user_profiles for update
  using (id = auth.uid());

-- reports
create policy "users can select their own reports"
  on public.reports for select
  using (created_by_user_id = auth.uid());

create policy "users can insert their own reports"
  on public.reports for insert
  with check (created_by_user_id = auth.uid());

create policy "users can update their own reports"
  on public.reports for update
  using (created_by_user_id = auth.uid());

create policy "users can delete their own reports"
  on public.reports for delete
  using (created_by_user_id = auth.uid());

-- report_sources
create policy "users can manage sources for their reports"
  on public.report_sources for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

-- extracted_people
create policy "users can manage extracted people for their reports"
  on public.extracted_people for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

-- extracted_addresses
create policy "users can manage extracted addresses for their reports"
  on public.extracted_addresses for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

-- extracted_phones
create policy "users can manage extracted phones for their reports"
  on public.extracted_phones for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

-- extracted_vehicles
create policy "users can manage extracted vehicles for their reports"
  on public.extracted_vehicles for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

-- extracted_associates
create policy "users can manage extracted associates for their reports"
  on public.extracted_associates for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

-- extracted_employment
create policy "users can manage extracted employment for their reports"
  on public.extracted_employment for all
  using (
    report_id in (
      select id from public.reports where created_by_user_id = auth.uid()
    )
  );

-- ─── Functions & Triggers ─────────────────────────────────────────────────────

-- Auto-create user_profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at on reports
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reports_updated_at
  before update on public.reports
  for each row execute procedure public.set_updated_at();
