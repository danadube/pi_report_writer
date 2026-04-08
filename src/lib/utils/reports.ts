import { ReportStatus, ReportType } from "@/types";

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getReportTypeLabel(type: ReportType): string {
  const labels: Record<ReportType, string> = {
    [ReportType.BACKGROUND_INVESTIGATION]: "Background Investigation",
    [ReportType.SURVEILLANCE]: "Surveillance",
  };
  return labels[type] ?? type;
}

export function getStatusLabel(status: ReportStatus): string {
  const labels: Record<ReportStatus, string> = {
    [ReportStatus.DRAFT]: "Draft",
    [ReportStatus.FINAL]: "Final",
    [ReportStatus.ARCHIVED]: "Archived",
  };
  return labels[status] ?? status;
}

export function getStatusVariant(
  status: ReportStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case ReportStatus.FINAL:
      return "default";
    case ReportStatus.DRAFT:
      return "secondary";
    case ReportStatus.ARCHIVED:
      return "outline";
    default:
      return "secondary";
  }
}
