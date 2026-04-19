-- One persisted final snapshot per draft version (idempotent finalize).
create unique index if not exists report_final_snapshots_one_per_draft_version
  on public.report_final_snapshots (draft_version_id);
