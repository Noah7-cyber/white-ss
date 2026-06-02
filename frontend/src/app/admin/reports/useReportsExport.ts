"use client";

import { useState, useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { showToast } from "@/modules/shared/component/Toast";
import {
  downloadBillingReportExport,
  downloadBillingSummaryExport,
  downloadAttendanceReportExport,
  downloadAttendanceHoursExport,
  downloadAdminStudentReportExport,
  downloadAdminStaffReportExport,
  downloadFormPerformanceExport,
} from "@/services/analytics.service";
import { downloadToursExport } from "@/services/tour.service";

// The Reports > Attendance > Check-in/out filter dropdown stores user-facing
// labels ("Checked In", "Absent", ...) which don't line up with the backend
// AttendanceStatus enum ("present", "absent", ...). Map the obvious cases and
// drop the rest so we never send an invalid value to the export endpoint.
function mapAttendanceStatus(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "absent") return "absent";
  if (v === "late") return "late";
  if (v === "present" || v === "checked in" || v === "checked out") return "present";
  return undefined;
}

// Maps the current pathname to the right backend export endpoint and forwards
// the relevant URL filters (classroomId, date range, status). Used by the
// shared Reports layout's Export button so the 11 admin tabular reports do
// not each need their own button.
export function useReportsExport() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);

  const startDate = searchParams?.get("startDate") ?? undefined;
  const endDate = searchParams?.get("endDate") ?? undefined;
  const classroomId = searchParams?.get("classroomId") ?? undefined;
  const depositStatus = searchParams?.get("depositStatus") ?? undefined;
  const attendanceStatus = searchParams?.get("attendanceStatus") ?? undefined;

  const baseFilters = useMemo(
    () => ({
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(classroomId ? { classroomId } : {}),
    }),
    [startDate, endDate, classroomId],
  );

  const isExportable =
    pathname.includes("/admin/reports/billing/deposit") ||
    pathname.includes("/admin/reports/billing/transactions") ||
    pathname.includes("/admin/reports/billing/summary") ||
    pathname.includes("/admin/reports/attendance/check-in-out") ||
    pathname.includes("/admin/reports/attendance/hours") ||
    pathname.includes("/admin/reports/attendance/classrooms") ||
    pathname.includes("/admin/reports/children/activities") ||
    pathname.includes("/admin/reports/children/learnings") ||
    pathname.startsWith("/admin/reports/staff") ||
    pathname.includes("/admin/reports/admission/tours") ||
    pathname.includes("/admin/reports/admission/forms");

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      if (pathname.includes("/admin/reports/billing/deposit")) {
        await downloadBillingReportExport({
          ...baseFilters,
          type: "deposit",
          ...(depositStatus
            ? { status: String(depositStatus).toLowerCase().replace(/ /g, "_") }
            : {}),
        });
      } else if (pathname.includes("/admin/reports/billing/transactions")) {
        await downloadBillingReportExport({ ...baseFilters, type: "transaction" });
      } else if (pathname.includes("/admin/reports/billing/summary")) {
        await downloadBillingSummaryExport(baseFilters);
      } else if (pathname.includes("/admin/reports/attendance/check-in-out")) {
        const mappedStatus = mapAttendanceStatus(attendanceStatus);
        await downloadAttendanceReportExport({
          ...baseFilters,
          type: "check-in-out",
          ...(mappedStatus ? { status: mappedStatus } : {}),
        });
      } else if (pathname.includes("/admin/reports/attendance/hours")) {
        await downloadAttendanceHoursExport(baseFilters);
      } else if (pathname.includes("/admin/reports/attendance/classrooms")) {
        await downloadAttendanceReportExport({
          ...baseFilters,
          type: "classrooms",
        });
      } else if (pathname.includes("/admin/reports/children/activities")) {
        await downloadAdminStudentReportExport({
          ...baseFilters,
          type: "activities",
        });
      } else if (pathname.includes("/admin/reports/children/learnings")) {
        await downloadAdminStudentReportExport({
          ...baseFilters,
          type: "learning",
        });
      } else if (pathname.startsWith("/admin/reports/staff")) {
        await downloadAdminStaffReportExport(baseFilters);
      } else if (pathname.includes("/admin/reports/admission/tours")) {
        await downloadToursExport();
      } else if (pathname.includes("/admin/reports/admission/forms")) {
        await downloadFormPerformanceExport({
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        });
      } else {
        showToast({
          severity: "info",
          message: "Export is not available for this report",
        });
        return;
      }
      showToast({ severity: "success", message: "Report exported successfully" });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to export report";
      showToast({ severity: "error", message });
    } finally {
      setIsExporting(false);
    }
  }, [pathname, baseFilters, depositStatus, attendanceStatus, startDate, endDate]);

  return { handleExport, isExporting, isExportable };
}
