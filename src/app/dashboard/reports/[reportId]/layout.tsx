import { LastWorkedReportTracker } from "@/components/reports/last-worked-report-tracker";

export default async function ReportIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;

  return (
    <>
      <LastWorkedReportTracker reportId={reportId} />
      {children}
    </>
  );
}
