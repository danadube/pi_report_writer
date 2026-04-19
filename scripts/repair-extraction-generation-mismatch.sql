-- One-off repair for reports that saved extracted_* rows but failed to bump
-- reports.extraction_generation (e.g. missing increment_report_extraction_generation RPC).
--
-- Symptom: report_sources.extraction_status = 'failed' with an error mentioning
-- extraction_generation could not be updated, while extracted_* data is present.
-- Effect: reports.extraction_generation stayed stale vs new extraction output, so
-- report_draft_versions.extraction_generation may falsely match the report and
-- stale warnings / staleness detection do not fire when they should.
--
-- Prefer: re-run extraction for the affected source after the RPC migration — that
-- replaces rows and bumps generation in one flow.
--
-- Use this SQL only when you intentionally want to bump the report counter without
-- re-extracting (e.g. data is already correct and you only need to resync the counter).

-- 1) Inspect candidates (run in SQL editor; review rows before mutating)
SELECT
  r.id AS report_id,
  r.extraction_generation,
  rs.id AS source_id,
  rs.extraction_status,
  left(rs.extraction_error, 200) AS extraction_error_preview
FROM public.reports r
JOIN public.report_sources rs ON rs.report_id = r.id
WHERE rs.extraction_error IS NOT NULL
  AND rs.extraction_error ILIKE '%extraction_generation could not be updated%';

-- 2) Repair: increment generation once per affected report (idempotent risk: if you
-- already re-ran extraction successfully, do not run this — generation is already correct)
--
-- Uncomment to execute:
-- UPDATE public.reports r
-- SET
--   extraction_generation = coalesce(r.extraction_generation, 1) + 1,
--   updated_at = now()
-- WHERE r.id IN (
--   SELECT DISTINCT rs.report_id
--   FROM public.report_sources rs
--   WHERE rs.extraction_error IS NOT NULL
--     AND rs.extraction_error ILIKE '%extraction_generation could not be updated%'
-- );

-- 3) Optional follow-up: after bumping, re-run extraction from the app, or manually set
--    report_sources.extraction_status / extraction_error for sources you trust.
