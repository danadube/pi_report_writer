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
          extraction_status: "pending" | "running" | "complete" | "failed";
          extraction_error: string | null;
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
          extraction_status?: "pending" | "running" | "complete" | "failed";
          extraction_error?: string | null;
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
          extraction_status?: "pending" | "running" | "complete" | "failed";
          extraction_error?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      extracted_people: {
        Row: {
          id: string;
          report_id: string;
          source_id: string | null;
          full_name: string;
          dob: string | null;
          ssn: string | null;
          drivers_license_number: string | null;
          drivers_license_state: string | null;
          aliases: string[];
          include_in_report: boolean;
        };
        Insert: {
          id?: string;
          report_id: string;
          source_id?: string | null;
          full_name?: string;
          dob?: string | null;
          ssn?: string | null;
          drivers_license_number?: string | null;
          drivers_license_state?: string | null;
          aliases?: string[];
          include_in_report?: boolean;
        };
        Update: {
          id?: string;
          report_id?: string;
          source_id?: string | null;
          full_name?: string;
          dob?: string | null;
          ssn?: string | null;
          drivers_license_number?: string | null;
          drivers_license_state?: string | null;
          aliases?: string[];
          include_in_report?: boolean;
        };
        Relationships: [];
      };
      extracted_addresses: {
        Row: {
          id: string;
          report_id: string;
          source_id: string | null;
          label: string | null;
          street: string;
          city: string;
          state: string;
          zip: string;
          date_range_text: string | null;
          include_in_report: boolean;
        };
        Insert: {
          id?: string;
          report_id: string;
          source_id?: string | null;
          label?: string | null;
          street?: string;
          city?: string;
          state?: string;
          zip?: string;
          date_range_text?: string | null;
          include_in_report?: boolean;
        };
        Update: {
          id?: string;
          report_id?: string;
          source_id?: string | null;
          label?: string | null;
          street?: string;
          city?: string;
          state?: string;
          zip?: string;
          date_range_text?: string | null;
          include_in_report?: boolean;
        };
        Relationships: [];
      };
      extracted_phones: {
        Row: {
          id: string;
          report_id: string;
          source_id: string | null;
          phone_number: string;
          phone_type: string | null;
          include_in_report: boolean;
        };
        Insert: {
          id?: string;
          report_id: string;
          source_id?: string | null;
          phone_number?: string;
          phone_type?: string | null;
          include_in_report?: boolean;
        };
        Update: {
          id?: string;
          report_id?: string;
          source_id?: string | null;
          phone_number?: string;
          phone_type?: string | null;
          include_in_report?: boolean;
        };
        Relationships: [];
      };
      extracted_vehicles: {
        Row: {
          id: string;
          report_id: string;
          source_id: string | null;
          year: string | null;
          make: string | null;
          model: string | null;
          vin: string | null;
          plate: string | null;
          state: string | null;
          include_in_report: boolean;
        };
        Insert: {
          id?: string;
          report_id: string;
          source_id?: string | null;
          year?: string | null;
          make?: string | null;
          model?: string | null;
          vin?: string | null;
          plate?: string | null;
          state?: string | null;
          include_in_report?: boolean;
        };
        Update: {
          id?: string;
          report_id?: string;
          source_id?: string | null;
          year?: string | null;
          make?: string | null;
          model?: string | null;
          vin?: string | null;
          plate?: string | null;
          state?: string | null;
          include_in_report?: boolean;
        };
        Relationships: [];
      };
      extracted_associates: {
        Row: {
          id: string;
          report_id: string;
          source_id: string | null;
          name: string;
          relationship_label: string | null;
          include_in_report: boolean;
        };
        Insert: {
          id?: string;
          report_id: string;
          source_id?: string | null;
          name?: string;
          relationship_label?: string | null;
          include_in_report?: boolean;
        };
        Update: {
          id?: string;
          report_id?: string;
          source_id?: string | null;
          name?: string;
          relationship_label?: string | null;
          include_in_report?: boolean;
        };
        Relationships: [];
      };
      extracted_employment: {
        Row: {
          id: string;
          report_id: string;
          source_id: string | null;
          employer_name: string;
          role_title: string | null;
          include_in_report: boolean;
        };
        Insert: {
          id?: string;
          report_id: string;
          source_id?: string | null;
          employer_name?: string;
          role_title?: string | null;
          include_in_report?: boolean;
        };
        Update: {
          id?: string;
          report_id?: string;
          source_id?: string | null;
          employer_name?: string;
          role_title?: string | null;
          include_in_report?: boolean;
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
    Functions: {
      delete_extracted_for_source: {
        Args: {
          p_report_id: string;
          p_source_id: string;
        };
        Returns: undefined;
      };
    };
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
