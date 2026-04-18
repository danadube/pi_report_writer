-- Optional subject slot (TLO Subject N of M) for non-person extracted rows so UI can group by subject.
ALTER TABLE public.extracted_addresses
  ADD COLUMN IF NOT EXISTS subject_index integer;

ALTER TABLE public.extracted_phones
  ADD COLUMN IF NOT EXISTS subject_index integer;

ALTER TABLE public.extracted_emails
  ADD COLUMN IF NOT EXISTS subject_index integer;

ALTER TABLE public.extracted_vehicles
  ADD COLUMN IF NOT EXISTS subject_index integer;

ALTER TABLE public.extracted_associates
  ADD COLUMN IF NOT EXISTS subject_index integer;

ALTER TABLE public.extracted_employment
  ADD COLUMN IF NOT EXISTS subject_index integer;
