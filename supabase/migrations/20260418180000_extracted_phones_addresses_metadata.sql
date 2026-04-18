-- Phone confidence (0–100) and structured address date range (TLO-style text dates).
alter table public.extracted_phones
  add column if not exists confidence smallint;

alter table public.extracted_addresses
  add column if not exists date_from text,
  add column if not exists date_to text;

comment on column public.extracted_phones.confidence is 'Match confidence percentage when provided by source (e.g. 90).';
comment on column public.extracted_addresses.date_from is 'Start of reported address range (e.g. MM/DD/YYYY).';
comment on column public.extracted_addresses.date_to is 'End of reported address range.';
