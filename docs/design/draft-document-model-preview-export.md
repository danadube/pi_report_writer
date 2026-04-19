# Design Doc 2 — Draft Document Model and Preview/Export Architecture

## 1. Problem statement

There is currently no shared document model between:

- summary preview
- print view
- export/PDF rendering

That guarantees duplication and drift if you build forward naively.

The draft document must become a first-class assembled object derived from composition state, not a React-side convenience projection.

## 2. Non-goals

This phase should not try to solve:

- beautiful final formatting
- full prose narrative generation
- court-ready document styling
- dynamic template marketplaces
- WYSIWYG editing

The first goal is structural alignment, not polish.

## 3. Required architectural decisions

### A. What is the canonical assembled draft format?

You need one.

### B. Where is the draft assembled?

Server-side. Not in React.

### C. What gets rendered: structured fact blocks or prose?

Structured fact blocks first. Full prose later.

### D. When do you persist snapshots?

On finalize/export, not on every checkbox click unless performance proves you need caching.

## 4. Proposed draft document model

Use a single JSON-compatible structure like this:

- `report`
  - `report_id`
  - `composition_id`
  - `extraction_generation`
  - `document_version`
  - `subjects[]`
    - `subject_index`
    - `subject_label`
    - `sections[]`
      - `section_key`
      - `section_label`
      - `blocks[]`

Each block should carry:

- `block_id`
- `composition_item_id`
- `block_type`
- `display_payload`
- `source_refs`
- `status` optional
- `confidence_meta` optional

### Why blocks instead of raw text only?

Because raw prose locks you too early into one narrative style and makes debugging harder.

**Block types can be:**

- `field_list`
- `single_fact`
- `multi_fact_group`
- `warning`
- `conflict_note`

**Example:**

- a “phones” section could render a list of included phone facts
- an “addresses” section could render current and prior address groups
- an ambiguity block could say attribution needs review

That is a real draft model. Not just JSX state.

## 5. Assembly architecture

### Input

- active composition for report
- composition items in included/review-needed states as applicable
- report metadata
- subject ordering rules
- section ordering rules

### Assembly location

Server-side service. Not the page component.

**Example ownership:**

- `src/lib/reports/build-report-draft.ts` or equivalent

### Output

- draft document model object

### What assembly must own

- section ordering
- subject grouping
- block formation
- inclusion filtering
- minimal display text normalization
- provenance carry-through

### What assembly must not own

- React rendering decisions
- PDF-specific layout
- extraction heuristics
- ranking computation

## 6. Rendering architecture

### Preview renderer

Consumes draft document model. Renders blocks. No business logic beyond display concerns.

### Print renderer

Consumes the exact same draft document model. Different visual presentation only.

### Export renderer

Consumes same draft document model or finalized snapshot. Transforms to PDF/HTML as needed.

If a renderer needs additional transformation, that transformation must be format-layer only. Not report-content logic.

## 7. Persistence strategy

### Draft document

Do not persist every recomputed draft initially. Compute on demand from composition state.

**Why:**

- composition is the source of truth
- draft can be rebuilt deterministically
- you avoid stale cached draft garbage early

### Final snapshot

Persist on finalization/export. That becomes immutable.

## 8. Failure modes and tradeoffs

**Failure mode: preview slower than desired**

Acceptable early if composition size is moderate. If needed later, cache the assembled draft with invalidation on composition changes.

**Failure mode: renderers start sneaking in content logic**

This will happen unless you enforce ownership. You need discipline here.

**Failure mode: block model feels too rigid for later prose**

That is fine. You can add prose-oriented block types later without rewriting the whole model.

## 9. Recommended implementation sequence

1. create composition-backed draft assembler
2. rebuild summary preview against it
3. rebuild print view against it
4. add snapshot persistence for finalization
5. add PDF export using final snapshot or draft document model

## 10. Open questions

**Q1. Should review-needed items appear in the draft?**

**Recommendation:**

- not by default in the main included flow
- optionally surface as warning blocks or a side review panel

**Q2. Should there be one section order globally or per template/report type?**

**Recommendation:**

- global per report type
- do not over-engineer template variability yet

## Hard truths

If you let React components assemble draft content:

- you will duplicate business logic
- print/export will drift
- debugging will become impossible
- every UI cleanup will mutate report behavior accidentally

That is amateur architecture. Do not do it.
