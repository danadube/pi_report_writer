# Design Doc 1 — Report Composition Layer

## 1. Problem statement

The current system has no persisted report-composition layer.

Today you have:

- extracted source facts in `extracted_*` tables
- ephemeral ranked summary candidates computed on request
- client-only selection state
- no durable report draft state
- no shared structure between preview and print/export

That means the system cannot reliably answer:

- what exactly the user selected
- why a fact appears in the draft
- whether a draft is stale after re-extraction
- whether preview and export refer to the same report content

This is the structural blocker. Until it is fixed, “summary preview” is just a temporary UI projection over unstable derived data.

## 2. Non-goals

This phase should not try to solve:

- final prose generation quality
- full PDF rendering fidelity
- automatic remapping of editorial state across re-extraction
- advanced cross-subject conflict resolution
- generic support for every future source type
- model-assisted narrative writing
- collaborative editing

Trying to solve those now will bloat the design and make it worse.

## 3. Required architectural decisions

These decisions cannot be deferred.

### A. What is the durable selectable unit?

Not `SummaryCandidate.id`. Not current extracted row UUIDs alone.

You need a persisted composition item that represents a report-usable fact or grouped fact assertion.

### B. What is the source of truth for “included in report”?

It cannot remain split between:

- `include_in_report` on extracted rows
- summary checkbox UI state

The source of truth for report inclusion must become the composition layer.

### C. What happens when extraction is rerun?

You need an explicit stale/review-required model. Do not fake continuity.

### D. What structure do preview and export consume?

They must consume the same document model assembled from composition items.

### E. What role does ranking play after composition exists?

Ranking must remain advisory. It should inform candidate generation, not own editorial truth.

## 4. Proposed source-of-truth model

This is the model you should adopt.

### Layer 1: Extracted observations

**Purpose:**

- store source-scoped structured outputs from parsing/extraction

**Persistence:**

- persisted in `extracted_*` tables

**Identity:**

- current extracted row UUIDs are acceptable as extraction-run-local identities only

**Must not own:**

- final report inclusion truth
- final section ordering
- final rendered summary text

**Notes:**

- `include_in_report` can remain as an extraction/system hint, but not editorial truth

### Layer 2: Candidate suggestions

**Purpose:**

- produce ranked, section-aware, subject-aware suggestions for the user to review

**Persistence:**

- may remain computed initially
- optionally persisted later for audit/versioning if needed

**Identity:**

- ephemeral
- must not be used as the durable user-selection anchor

**Must not own:**

- final report state
- user editorial decisions
- print/export structure

**Notes:**

- current summary-prep output belongs here

### Layer 3: Composition / editorial decisions

**Purpose:**

- represent durable user decisions about what belongs in the report draft

**Persistence:**

- persisted

**Identity:**

- composition item IDs are the durable unit for the draft workflow

**Must own:**

- included/excluded/review-needed state
- subject scope
- section scope
- provenance references
- normalized display payload used for report assembly
- ordering within the composition context

**Must not own:**

- raw parser truth
- heavy extraction logic
- final visual rendering markup

This is the missing architectural layer.

### Layer 4: Draft document

**Purpose:**

- assembled report structure derived from composition state
- used by preview and print

**Persistence:**

- computed on demand at first
- optional snapshot/cache later

**Identity:**

- draft version or assembly timestamp if needed
- not the primary editorial source of truth

**Must own:**

- section structure
- block ordering
- rendered structured text fragments or field/value blocks

**Must not own:**

- raw extraction rows as source of truth
- permanent editorial decisions

### Layer 5: Final rendered/export snapshot

**Purpose:**

- frozen output used for final print/export/history

**Persistence:**

- persisted when user finalizes/export-locks a report

**Identity:**

- immutable snapshot/version ID

**Must own:**

- frozen output payload
- export-ready source document structure and/or rendered artifact reference

**Must not own:**

- ongoing editorial state
- extraction logic

## 5. Proposed data model changes

You do not need speculative complexity. You do need enough structure to stop lying to yourself.

### A. Add `report_compositions`

One row per report draft lineage.

**Suggested fields:**

- `id`
- `report_id`
- `status` (active, stale, finalized, archived)
- `source_generation` or `extraction_generation`
- `created_by`
- `created_at`
- `updated_at`
- `stale_reason` nullable
- `finalized_at` nullable

**Purpose:**

- top-level container for editorial state tied to a given extraction generation

This gives you a durable composition context instead of pretending the report itself is enough.

### B. Add `report_composition_items`

This is the core table.

**Suggested fields:**

- `id`
- `composition_id`
- `subject_index` nullable but strongly discouraged for included items
- `section_key`
- `entity_kind`
- `state` (included, excluded, review_needed)
- `origin_type` (candidate, manual, system)
- `display_payload` JSONB
- `sort_order`
- `source_ref_payload` JSONB
- `derived_from_hash` nullable
- `created_at`
- `updated_at`
- `user_note` nullable
- `review_reason` nullable

**Purpose:**

- stores the durable editorial unit the user is acting on

`display_payload` should contain the normalized fact content used for composition, for example:

- phone number + labels
- address text + current/prior classification
- associate name + relationship type
- employment employer/title

`source_ref_payload` should contain provenance references, likely as an array:

- `source_id`
- extracted table name
- extracted row ids
- optional supporting labels/snippets

**Why JSONB here is acceptable:**

- composition items are editorial objects, not raw normalized extraction tables
- you want flexibility without schema explosion
- the extracted tables remain the real structured source layer

### C. Add `report_composition_events` or equivalent audit trail

**Suggested fields:**

- `id`
- `composition_id`
- `composition_item_id`
- `event_type`
- `old_state`
- `new_state`
- `actor_user_id`
- `metadata` JSONB
- `created_at`

**Purpose:**

- tell you who included/excluded/reviewed what
- give you a minimal audit trail

This is not overkill in investigative software. It is basic trust infrastructure.

### D. Add `report_final_snapshots`

**Suggested fields:**

- `id`
- `report_id`
- `composition_id`
- `document_payload` JSONB
- `rendered_html` nullable
- `rendered_pdf_storage_path` nullable
- `created_by`
- `created_at`

**Purpose:**

- freeze final output
- separate mutable draft state from immutable deliverable state

### E. Add extraction generation tracking

You need a stable way to know whether composition belongs to the current extracted dataset.

You can do this with either:

- a generation integer on reports
- or a generation/version per `report_sources` set rolled up to the report

**Pragmatic recommendation:**

- add `reports.extraction_generation`
- increment when extraction data is materially replaced for any source in the report

Then `report_compositions.source_generation` can be compared directly.

That is blunt, simple, and good enough for now.

## 6. Identity and rerun strategy

This is where teams usually lie. Do not.

### What should be stable across reruns?

- the composition container can remain
- finalized snapshots must remain
- report identity remains
- source file identity remains if the same `report_source` remains

### What should not be assumed stable across reruns?

- extracted row UUIDs
- summary candidate IDs
- ranking score/order
- inferred grouping outcomes
- subject attribution for ambiguous rows

### What should happen on rerun?

**Recommendation for this phase:**

- increment `reports.extraction_generation`
- mark active composition as stale
- mark affected composition items as `review_needed` if they reference rerun-sensitive extracted content
- do not automatically remap included items unless a deterministic direct mapping exists and is proven safe

This is the honest design.

### What not to automate yet

Do not implement “smart carry-forward” of selection across reruns unless all of the following are true:

- the fact is deterministically matchable
- subject attribution still matches
- source lineage still matches
- normalized display value still matches materially

You do not have enough evidence to trust that yet.

Default to stale + review. That is safer and easier to reason about.

## 7. Failure modes and tradeoffs

**Tradeoff: more persistence, more moving parts**

Yes. But the alternative is fake stability.

**Failure mode: composition item payload drifts from extraction truth**

**Mitigation:**

- provenance references remain attached
- rerun marks composition stale
- finalized snapshots freeze output intentionally

**Failure mode: JSONB payloads become sloppy dumping grounds**

**Mitigation:**

- define strict payload contracts by `entity_kind`
- validate server-side before write

**Failure mode: review-needed state becomes noisy**

**Mitigation:**

- only mark as review-needed when extraction generation changes or source references disappear materially

**Failure mode: manual additions complicate the model**

That is fine. `origin_type = manual` handles it without poisoning extracted layers.

## 8. Recommended implementation sequence

1. Fix schema drift and cleanup integrity first.
2. Add extraction generation tracking.
3. Add `report_compositions`.
4. Add `report_composition_items`.
5. Build server-side API to create/update composition items from current candidate suggestions.
6. Replace client-only checkbox state with persisted composition state.
7. Build draft assembler on top of composition items.
8. Only then build final snapshot/export.

## 9. Open questions requiring product decisions

These are real decisions, not noise.

**Q1. Should one report have only one active composition at a time?**

**Recommendation:** yes, for now. Simpler. One active draft, many final snapshots.

**Q2. Should manual composition items be allowed in phase 1?**

**Recommendation:** yes, but limited. If you do not allow them now, you will end up hacking “notes” into the wrong place later.

**Q3. Should excluded items be persisted or only included items?**

**Recommendation:** persist both included and excluded, because exclusion is an editorial decision too. Otherwise reruns/rebuilds will keep re-suggesting the same junk with no memory.

## Hard truths

If you skip this layer and build preview directly from ephemeral candidates:

- reruns will destroy trust
- refreshes will destroy state
- preview and export will diverge
- “included in report” will remain split-brained
- multi-subject errors will look polished instead of obvious

That is the expensive mistake.
