/**
 * Minimal Supabase Database types for PI Report Writer.
 * Keep in sync with supabase/migrations/*.sql
 *
 * TODO: Regenerate from `supabase gen types typescript` when schema changes.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      reports: {
        Row: {
          id: string;
          organization_id: string | null;
          created_by_user_id: string;
          report_type: "BACKGROUND_INVESTIGATION" | "SURVEILLANCE";
          status: "DRAFT" | "FINAL" | "ARCHIVED";
          case_name: string;
          client_name: string;
          investigator_name: string;
          subject_name: string;
          report_date: string | null;
          summary_notes: string | null;
          generated_report_html: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          created_by_user_id: string;
          report_type: "BACKGROUND_INVESTIGATION" | "SURVEILLANCE";
          status?: "DRAFT" | "FINAL" | "ARCHIVED";
          case_name?: string;
          client_name?: string;
          investigator_name?: string;
          subject_name?: string;
          report_date?: string | null;
          summary_notes?: string | null;
          generated_report_html?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          created_by_user_id?: string;
          report_type?: "BACKGROUND_INVESTIGATION" | "SURVEILLANCE";
          status?: "DRAFT" | "FINAL" | "ARCHIVED";
          case_name?: string;
          client_name?: string;
          investigator_name?: string;
          subject_name?: string;
          report_date?: string | null;
          summary_notes?: string | null;
          generated_report_html?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      report_sources: {
        Row: {
          id: string;
          report_id: string;
          source_type:
            | "TLO_COMPREHENSIVE"
            | "DMV_RECORDS"
            | "MANUAL_ENTRY"
            | "OTHER";
          file_name: string;
          file_url: string;
          extracted_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          source_type:
            | "TLO_COMPREHENSIVE"
            | "DMV_RECORDS"
            | "MANUAL_ENTRY"
            | "OTHER";
          file_name?: string;
          file_url?: string;
          extracted_text?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          source_type?:
            | "TLO_COMPREHENSIVE"
            | "DMV_RECORDS"
            | "MANUAL_ENTRY"
            | "OTHER";
          file_name?: string;
          file_url?: string;
          extracted_text?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          organization_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          email?: string;
          organization_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          organization_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      report_type: "BACKGROUND_INVESTIGATION" | "SURVEILLANCE";
      report_status: "DRAFT" | "FINAL" | "ARCHIVED";
      source_document_type:
        | "TLO_COMPREHENSIVE"
        | "DMV_RECORDS"
        | "MANUAL_ENTRY"
        | "OTHER";
    };
    CompositeTypes: Record<string, never>;
  };
}
