-- Subject-level identity fields (TLO and similar sources). dob already existed.
alter table public.extracted_people
  add column if not exists ssn text,
  add column if not exists drivers_license_number text,
  add column if not exists drivers_license_state text;

comment on column public.extracted_people.ssn is 'Last-known SSN from source document (sensitive; treat as PII).';
comment on column public.extracted_people.drivers_license_number is 'Driver license number from source document.';
comment on column public.extracted_people.drivers_license_state is 'Issuing state for driver license (e.g. IL).';
