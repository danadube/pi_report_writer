"use client";

import { useEffect } from "react";
import {
  saveLastWorkedReport,
  type LastWorkedReportSnapshot,
} from "@/lib/last-worked-report";

/**
 * Persists “last worked” from data the server already loaded for this route.
 * Avoids a redundant client fetch that can fail (auth, errors swallowed) and never write localStorage.
 */
export function LastWorkedReportTracker({
  snapshot,
}: {
  snapshot: LastWorkedReportSnapshot;
}) {
  useEffect(() => {
    saveLastWorkedReport(snapshot);
  }, [snapshot]);

  return null;
}
