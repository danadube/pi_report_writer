# Design Doc 3 — Multi-Subject Rules and Rerun Behavior

## 1. Problem statement

Multi-subject support exists, but it is fragile and heuristic-driven. Subject attribution can silently fail when `subject_index` is null or weak. Re-extraction currently replaces rows and changes identities, which makes editorial state unstable.

You need explicit rules now. Not later.

## 2. Non-goals

This phase should not try to solve:

- perfect attribution
- cross-document identity resolution
- automatic fact reconciliation across major extraction changes
- smart merging of all shared-household cases

## 3. Required architectural decisions

### A. Can included composition items have null `subject_index`?

**Recommendation:** no, except for explicitly report-level sections.

### B. How are shared facts represented?

**Recommendation:** duplicate as subject-scoped composition items with shared provenance, not one floating global fact unless the section is intentionally report-global.

### C. What happens to null-attribution extracted rows?

**Recommendation:** they should not silently fall into the primary subject in composition. That is where the current design is lying.

## 4. Proposed subject-scoped composition rules

### Rule 1: composition items are subject-scoped by default

Any fact intended to appear in a subject section must carry a non-null `subject_index`.

### Rule 2: null subject attribution must be explicit

If extracted data lacks `subject_index`, then candidate generation can still surface it, but composition must classify it as one of:

- assign to subject X
- exclude
- review-needed / unresolved

It must not silently become Subject 1 in the durable report model.

### Rule 3: report-level sections are the exception

Some sections may be explicitly report-level:

- investigator notes
- source inventory
- unresolved conflicts
- methodology note

Those can live outside subject-specific sections.

### Rule 4: shared facts should remain duplicated at the composition layer when necessary

If an address or associate is genuinely relevant to multiple subjects, represent that as multiple composition items linked to the same provenance, not one global item trying to mean two things at once.

**Why:**

- report output is subject-oriented
- editorial inclusion is subject-oriented
- debugging is clearer

### Rule 5: conflicting facts should be representable, not collapsed

Do not force one truth if extraction evidence disagrees. Allow:

- included fact A
- review-needed conflicting fact B
- or a conflict block in the draft

That is more honest than fake certainty.

## 5. Rerun behavior

### Current reality

Rerun means delete-and-reinsert extracted rows. Therefore identities shift. Therefore composition cannot pretend nothing changed.

### Recommended behavior

When extraction generation changes:

- mark active composition stale
- mark composition items `review_needed` if their provenance references now point to missing or materially changed extracted facts
- preserve existing composition state for user review
- do not overwrite final snapshots

### Why not auto-remap aggressively?

Because it will lie in edge cases:

- same value, wrong subject
- same value, different source support
- same value, changed normalization
- same value, conflicting new evidence

That is worse than asking for review.

## 6. Material-change rules

You need explicit stale triggers.

### A composition item should become `review_needed` when:

- one or more referenced extracted rows no longer exist
- referenced subject attribution changes
- normalized display value changes materially
- source support narrows or disappears
- section classification changes

### A composition item may remain valid without review when:

- only ranking score changes
- supporting metadata changes but display payload and provenance meaning remain the same
- non-semantic formatting changes occur

## 7. Failure modes and tradeoffs

**Tradeoff: more user review after reruns**

Yes. But it is honest.

**Failure mode: too many review-needed items after rerun**

That is acceptable early. You can optimize later once you understand real rerun patterns.

**Failure mode: duplicate shared facts across subjects feel repetitive**

That is a UX problem, not a reason to destroy attribution clarity.

## 8. Recommended implementation sequence

1. stop silent primary-subject assignment in durable composition
2. require explicit subject assignment for included subject-scoped items
3. add stale/review-needed flags tied to extraction generation
4. keep rerun behavior conservative
5. optimize remapping only after real data proves it is safe

## 9. Open questions

**Q1. Do you want unresolved facts visible in the main draft or only in review tooling?**

This is a product decision. **Architectural recommendation:** keep them out of the main included sections by default, but surface them clearly in review mode.

**Q2. Are there report types where some sections should be intentionally report-global?**

Probably yes. You should identify those early so the document model has a legitimate non-subject section path.

## Hard truths

If you keep letting null-attribution facts silently attach to Subject 1:

- the system will generate plausible but wrong reports
- multi-subject trust will collapse
- debugging will become finger-pointing instead of engineering

That is not a minor edge case. It is a core integrity failure.
