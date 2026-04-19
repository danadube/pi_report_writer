import type { Json } from "@/lib/supabase/database.types";

export type DraftVersionStatus =
  | "draft"
  | "active"
  | "stale"
  | "finalized"
  | "archived";

export type DraftItemScope = "subject" | "report";

export type DraftItemState = "included" | "excluded" | "review_needed";

export type DraftItemOrigin = "candidate" | "manual" | "system_warning";

/** API shape for report_draft_versions (JSON-serializable). */
export interface ReportDraftVersionDTO {
  id: string;
  report_id: string;
  version_number: number;
  title: string;
  status: DraftVersionStatus;
  based_on_draft_version_id: string | null;
  extraction_generation: number;
  has_blocking_warnings: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  stale_reason: string | null;
}

/** List entries include server-computed counts for dashboard UI. */
export interface ReportDraftVersionWithCounts extends ReportDraftVersionDTO {
  review_needed_count: number;
  warning_count: number;
}

/** API shape for report_draft_items. */
export interface ReportDraftItemDTO {
  id: string;
  draft_version_id: string;
  scope: DraftItemScope;
  subject_index: number | null;
  section_key: string;
  entity_kind: string;
  state: DraftItemState;
  origin_type: DraftItemOrigin;
  display_payload: Json;
  source_ref_payload: Json | null;
  sort_order: number;
  review_reason: string | null;
  user_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DraftVersionWithItemsResponse {
  version: ReportDraftVersionDTO;
  items: ReportDraftItemDTO[];
}
