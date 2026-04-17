import { formatDate, getReportTypeLabel } from "@/lib/utils/reports";
import type { Report } from "@/types";

interface ReportPrintViewProps {
  report: Report;
}

/**
 * Print-safe report layout.
 * Uses inline-friendly Tailwind classes.
 *
 * TODO: Pull extracted_* sections into print when extraction is wired.
 */
export function ReportPrintView({ report }: ReportPrintViewProps) {
  const summary =
    report.summary_notes?.trim() ||
    "No summary added yet.";

  return (
    <div className="bg-white text-black max-w-3xl mx-auto p-10 rounded-lg shadow-lg print:shadow-none print:rounded-none print:max-w-none">
      {/* Header */}
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {getReportTypeLabel(report.report_type)} Report
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Prepared by: {report.investigator_name || "—"}
        </p>
      </div>

      {/* Case Information */}
      <Section title="Case Information">
        <InfoRow label="Case Name" value={report.case_name || "—"} />
        <InfoRow label="Client" value={report.client_name || "—"} />
        <InfoRow label="Report Date" value={formatDate(report.report_date)} />
        <InfoRow label="Investigator" value={report.investigator_name || "—"} />
      </Section>

      {/* Subject Identification */}
      <Section title="Subject Identification">
        <InfoRow label="Subject Name" value={report.subject_name || "—"} />
      </Section>

      {/* TODO: Address History section from extracted_addresses */}
      {/* TODO: Phone Information section from extracted_phones */}
      {/* TODO: Vehicle Information section from extracted_vehicles */}
      {/* TODO: Associates / Relatives section from extracted_associates */}
      {/* TODO: Employment Information section from extracted_employment */}

      {/* Investigator Summary */}
      <Section title="Investigator Summary & Notes">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary}</p>
      </Section>

      {/* Disclaimer */}
      <Section title="Disclaimer">
        <p className="text-xs text-gray-500">
          This report was prepared by a licensed private investigator using
          publicly available records and licensed data sources. The information
          contained herein is believed to be accurate at the time of
          compilation. This report is intended solely for the use of the
          requesting party and should not be distributed without authorization.
        </p>
      </Section>

      {/* Signature Block */}
      <div className="mt-10 pt-6 border-t border-gray-300">
        <p className="text-sm font-semibold text-gray-900">
          Investigator Signature
        </p>
        <div className="mt-6 w-56 border-b border-gray-400" />
        <p className="text-sm text-gray-600 mt-1">{report.investigator_name || "—"}</p>
        <p className="text-sm text-gray-400 mt-0.5">
          {formatDate(report.report_date)}
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 border-b border-gray-200 pb-1 mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-1">
      <span className="w-36 flex-shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}
