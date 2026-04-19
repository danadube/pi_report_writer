# Draft composition — phase 0–1 (implementation notes)

## What was added

### Database (Supabase SQL migrations)

- **`reports.extraction_generation`**: `bigint`, default `1`, used to detect when extraction output has changed vs a draft version’s `extraction_generation` snapshot.
- **`increment_report_extraction_generation(p_report_id)`**: RPC that atomically increments `reports.extraction_generation` and touches `updated_at`.
- **`delete_extracted_for_source`**: now deletes **`extracted_emails`** in the same transaction as the other `extracted_*` tables.
- **`extracted_emails`**: `CREATE TABLE IF NOT EXISTS` + RLS policy (aligns repo migrations with app usage when the table only existed manually before).
- **Draft tables**:
  - `report_draft_versions` — versioning, status, `extraction_generation` snapshot, partial unique index enforcing **one `active` row per report**.
  - `report_draft_items` — editorial lines (`display_payload` / `source_ref_payload` JSONB), scope, section, state, origin.
  - `report_draft_events` — append-only audit log (insert-only RLS for authenticated owners).
  - `report_final_snapshots` — schema placeholder for finalized payloads (no workflow yet).

Apply with **Supabase CLI** (`supabase db push`, migration SQL, or Dashboard). **Prisma is not used** in this repo for schema migrations; do **not** run `npx prisma migrate deploy` for these changes.

### Application

- **Extraction**: After a successful `replaceExtractedDataForSource`, the pipeline calls `bumpReportExtractionGeneration`. Failures surface as extraction errors without wiping persisted rows in a way that implied “no data saved.”
- **Upload API**: Response includes **`extractionSucceeded`** (boolean) so clients can tell upload HTTP 201 from extraction success.
- **Summary prep**: Shared loader `loadSummaryPrepPayloadForReport` (same output as `/api/reports/[id]/summary-prep`).
- **Draft seeding**: `buildDraftSeedRowsFromSummaryPrep` maps summary-prep candidates to draft items. **`selected_by_default` → `included`**, otherwise **`excluded`**. Ephemeral **`SummaryCandidate.id`** and extraction **entity UUIDs** are **not** stored as durable keys; payloads hold display text, section key, optional label, optional ranking hint, and optional source file/source id snapshot.
- **Services**: `src/lib/drafts/draft-service.ts` — list, get with items, create seeded version, add manual item, patch item (blocks edits when version is `finalized`).
- **API routes** (all require auth; report must be owned by the user):
  - `GET/POST /api/reports/[id]/draft-versions`
  - `GET /api/reports/[id]/draft-versions/[versionId]`
  - `POST /api/reports/[id]/draft-versions/[versionId]/items`
  - `PATCH /api/reports/[id]/draft-versions/[versionId]/items/[itemId]`
  - `GET /api/reports/[id]/draft-versions/[versionId]/document` — assembled `DraftDocument` JSON (after stale enforcement).

### Phase 2 (validation, stale enforcement, assembler)

- **Registry** (`draft-item-registry.ts`): allowed `section_key` values (summary sections + `SYSTEM_WARNINGS`), valid `(scope, section_key, entity_kind, origin_type)` tuples, candidate entity kinds per summary section.
- **Payload validators** (`draft-payload-validators.ts`): candidate seed payloads, `manual_note` payloads, `stale_extraction` system warning payloads; seed rows validated before insert.
- **Stale service** (`draft-stale.ts`): on read (`getDraftVersionWithItems` / document route), compares `reports.extraction_generation` to `report_draft_versions.extraction_generation`; if they differ and the version is not finalized/archived, sets version `stale`, `has_blocking_warnings`, `stale_reason`, and upserts one report-level `system_warning` item (`SYSTEM_WARNINGS` / `stale_extraction`, `review_needed`). Events: `draft_marked_stale` (first transition only), `draft_stale_warning_created` (when the warning row is first inserted).
- **Assembler** (`build-draft-document.ts`): builds `DraftDocument` with `reportSections` and per-subject `sections` (deterministic section order); block types `fact` | `manual_note` | `warning`.

## Intentionally not implemented

- Background job to mark stale without a fetch (staleness is enforced when loading a draft version or the document).
- **Finalization** workflow and **immutability** enforced in the database (only in app logic for edits).
- **PDF / export** and shared preview UI wiring.
- Replacing or removing the **summary-prep** endpoint.
- **Branching** UX (`based_on_draft_version_id` is stored but not driven by UI).

## Known limitations

- **Staleness** is manual / future work: compare `report_draft_versions.extraction_generation` to `reports.extraction_generation`.
- **Concurrent creates** could theoretically race on `version_number` (unlikely in single-user flows).
- If **`increment_report_extraction_generation`** fails after structured rows are saved, the run fails and the UI shows an error, but rows may already be updated (generation bump is reported separately).
- **Manual draft item** requires **`subject_index`** when `scope` is `subject` (default).

## How seeding works (exact behavior)

1. Load sources + extracted data and build the same **`SummaryPrepPayload`** as summary-prep.
2. Flatten candidates in **section order** (`SUMMARY_SECTION_ORDER`) per subject block; assign **`sort_order`** in that sequence.
3. For each candidate, insert `report_draft_items` with `origin_type = candidate`, `scope = subject`, and `state` derived from **`selected_by_default`** only (not `include_in_report` on extracted rows).
