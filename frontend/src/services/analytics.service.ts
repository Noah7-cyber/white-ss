/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiMethods } from "@/utils/client";
import { downloadFile } from "@/utils/file-download";

/** Attendance period type for dashboard API */
export type DashboardAttendancePeriodType = "daily" | "weekly" | "monthly" | "yearly";

export interface AdminDashboardAnalyticsParams {
  startDate: string;
  endDate: string;
  attendancePeriodType?: DashboardAttendancePeriodType;
  periodType?: string;
  classroomId?: number | string;
  attendanceTrendType?: "student" | "staff";
}

export interface StaffDashboardAnalyticsParams {
  startDate: string;
  endDate: string;
  periodType?: DashboardAttendancePeriodType;
  classroomId?: number | string;
  staffId?: number;
}

export interface DashboardAnalyticsResponse {
  success: boolean;
  message: string;
  data: {
    students: {
      total: number;
      active: number;
      male: number;
      female: number;
      other: number;
      percentageGrowth: number;
    };
    admissions: {
      total: number;
      thisMonth: number;
      percentageGrowth: number;
    };
    staff: {
      total: number;
      active: number;
      percentageGrowth: number;
    };
    classrooms: {
      total: number;
      active: number;
      utilizationRate: number;
      percentageGrowth?: number;
    };
    attendance: {
      student: {
        rate: number;
        present: number;
        absent: number;
        late: number;
        percentageGrowth: number;
      };
      staff: {
        rate: number;
        present: number;
        absent: number;
        late: number;
        percentageGrowth: number;
      };
      combined: {
        rate: number;
        present: number;
        absent: number;
        late: number;
      };
    };
    attendanceTrend?: {
      periodType: string;
      xAxis: string[];
      present: number[];
      absent: number[];
      late: number[];
    };
  };
}

export interface StaffDashboardAnalyticsResponse {
  success: boolean;
  message: string;
  data: {
    totalStudents: number;
    totalSignedIn: number;
    totalLate: number;
    totalAbsent: number;
    percentageGrowth: number;
    classStats: {
      byGender: {
        xAxis: string[];
        yAxis: number[];
        percentages: number[];
      };
    };
    attendance: {
      xAxis: string[];
      present: number[];
      absent: number[];
      late: number[];
    };
    kioskPin?: string;
  };
  metadata: {
    date: string;
    attendanceRate: number;
  };
}

export interface GetAnalyticsResponse {
  success: boolean;
  message: string;
  school: DashboardAnalyticsResponse;
}

export interface EarningsAnalyticsResponse {
  success: boolean;
  message: string;
  data: {
    xAxis: string[];
    yAxis: number[];
  };
  metadata: {
    unit: string;
    total: number;
    startDate: string;
    endDate: string;
  };
}

export interface ParentDashboardResponse {
  success: boolean;
  message: string;
  data: {
    attendance: {
      xAxis: string[];
      present: number[];
      absent: number[];
      late: number[];
      percentageGrowth?: number;
    };
    activities: Array<{
      id: number;
      activityType: string;
      startTime?: string;
      endTime?: string;
      mealType?: string | null;
      timeGiven?: string | null;
      bathroomType?: string | null;
      foodItems?: string | null;
      medicationName?: string | null;
      dosage?: string | null;
      notes?: string;
      photoUrl?: string | null;
      createdAt: string;
      student?: {
        id: number;
        firstName: string;
        lastName: string;
        photoUrl?: string;
      };
    }>;
    kioskPin?: string;
    kioskLink?: string;
    kioskUrl?: string;
    attendanceKioskLink?: string;
    kioskQrCode?: string;
    kioskQrCodeUrl?: string;
    attendanceKioskQrCode?: string;
  };
  metadata: {
    date: string;
    totalStudents: number;
  };
}

// ========================
// Subject ROOT
// ========================
const analyticsRoot = "/api/v1/analytics";
const staffAnalyticsRoot = "/api/v1/analytics/staff";

// ========================
// CONFIG: Endpoints & Methods
// ========================
const analyticsEndpoints = {
  getAllAnalytics: { path: `${analyticsRoot}`, method: ApiMethods.GET },
  generateAnalyticsNumber: { path: `${analyticsRoot}/generate`, method: ApiMethods.POST },
  getStaffDashboardAnalytics: { path: `${staffAnalyticsRoot}/dashboard`, method: ApiMethods.GET },
  getAttendanceReport: { path: `${analyticsRoot}/attendance/report`, method: ApiMethods.GET },
  getStaffAttendanceReport: { path: `${analyticsRoot}/attendance/staff/analytics`, method: ApiMethods.GET },
  getBillingReport: { path: `${analyticsRoot}/billing`, method: ApiMethods.GET },
  getBillingSummery: { path: `${analyticsRoot}/billing/summary`, method: ApiMethods.GET },
  getStudentReport: { path: `${analyticsRoot}/reports/students`, method: ApiMethods.GET },
  getStaffReport: { path: `${analyticsRoot}/reports/staff`, method: ApiMethods.GET },
  getFormPerformance: { path: `${analyticsRoot}/forms/performance`, method: ApiMethods.GET },
  getAttendanceReportDownload: { path: `${analyticsRoot}/attendance/report/download`, method: ApiMethods.GET },
  actionCenter: { path: `${analyticsRoot}/action-center `, method: ApiMethods.GET },
};

function buildDashboardQuery(params: AdminDashboardAnalyticsParams): string {
  const search = new URLSearchParams();
  search.set("startDate", params.startDate);
  search.set("endDate", params.endDate);
  if (params.attendancePeriodType) {
    search.set("attendancePeriodType", params.attendancePeriodType);
  }
  if (params.periodType) {
    search.set("periodType", params.periodType);
  }
  if (params.classroomId != null && params.classroomId !== "") {
    search.set("classroomId", String(params.classroomId));
  }
  if (params.attendanceTrendType) {
    search.set("attendanceTrendType", params.attendanceTrendType);
  }
  return search.toString();
}

function buildStaffDashboardQuery(params: StaffDashboardAnalyticsParams): string {
  const search = new URLSearchParams();
  search.set("startDate", params.startDate);
  search.set("endDate", params.endDate);
  if (params.periodType) {
    search.set("periodType", params.periodType);
  }
  if (params.classroomId != null && params.classroomId !== "") {
    search.set("classroomId", String(params.classroomId));
  }
  if (params.staffId != null) {
    search.set("staffId", String(params.staffId));
  }
  return search.toString();
}

export interface ParentDashboardAnalyticsParams {
  startDate: string;
  endDate: string;
  periodType?: "daily" | "weekly" | "monthly";
}

function buildParentDashboardQuery(params: ParentDashboardAnalyticsParams): string {
  const search = new URLSearchParams();
  search.set("startDate", params.startDate);
  search.set("endDate", params.endDate);
  if (params.periodType) {
    search.set("periodType", params.periodType);
  }
  return search.toString();
}

// Dynamic endpoints (require SubjectId)
export const analyticsDynamicEndpoints = {
  getAdminDashboardAnalytics: (params: AdminDashboardAnalyticsParams) => ({
    path: `${analyticsRoot}/dashboard?${buildDashboardQuery(params)}`,
    method: ApiMethods.GET,
  }),
  getAdminEarningAnalytics: (params: AdminDashboardAnalyticsParams) => ({
    path: `${analyticsRoot}/earnings?${buildDashboardQuery(params)}`,
    method: ApiMethods.GET,
  }),
  getParentDashboardAnalytics: (params: ParentDashboardAnalyticsParams) => ({
    path: `${analyticsRoot}/parent/dashboard?${buildParentDashboardQuery(params)}`,
    method: ApiMethods.GET,
  }),
  getStaffDashboardAnalytics: (params: StaffDashboardAnalyticsParams) => ({
    path: `${staffAnalyticsRoot}/dashboard?${buildStaffDashboardQuery(params)}`,
    method: ApiMethods.GET,
  }),
};

// ========================
// SERVICE GENERATOR
// ========================
type ServiceInterface = {
  path: string;
  method: ApiMethods;
};

function generateServices<T extends Record<string, { path: string; method: ApiMethods }>>(
  endpoints: T,
) {
  const services: Record<keyof T, ServiceInterface> = {} as any;
  for (const key in endpoints) {
    services[key] = {
      path: endpoints[key].path,
      method: endpoints[key].method,
    };
  }
  return services;
}

// ========================
// EXPORTS
// ========================
export const analyticsServices = generateServices(analyticsEndpoints);

// ============================================================
// Excel-export helpers — each one mirrors a list endpoint and
// streams an .xlsx file back to the browser through `downloadFile`.
// ============================================================

interface BillingExportParams {
  type?: "deposit" | "transaction";
  startDate?: string;
  endDate?: string;
  classroomId?: number | string;
  studentId?: number | string;
  parentId?: number | string;
  status?: string;
}

function omitEmpty<T extends Record<string, unknown>>(obj: T): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v as string | number;
  }
  return out;
}

export async function downloadBillingReportExport(params: BillingExportParams): Promise<void> {
  const fallback =
    params.type === "transaction" ? "billing-transactions.xlsx" : "billing-deposits.xlsx";
  return downloadFile({
    endpoint: `${analyticsRoot}/billing/export`,
    params: omitEmpty(params as Record<string, unknown>),
    fallbackFilename: fallback,
  });
}

export async function downloadBillingSummaryExport(params: Omit<BillingExportParams, "type">): Promise<void> {
  return downloadFile({
    endpoint: `${analyticsRoot}/billing/summary/export`,
    params: omitEmpty(params as Record<string, unknown>),
    fallbackFilename: "billing-summary.xlsx",
  });
}

interface AttendanceReportExportParams {
  type: "check-in-out" | "classrooms";
  classroomId?: number | string;
  status?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

export async function downloadAttendanceReportExport(
  params: AttendanceReportExportParams,
): Promise<void> {
  const fallback =
    params.type === "classrooms" ? "attendance-classrooms.xlsx" : "attendance-check-in-out.xlsx";
  return downloadFile({
    endpoint: `${analyticsRoot}/reports/attendance/export`,
    params: omitEmpty(params as Record<string, unknown>),
    fallbackFilename: fallback,
  });
}

interface AttendanceAnalyticsExportParams {
  startDate?: string;
  endDate?: string;
  periodType?: DashboardAttendancePeriodType;
  classroomId?: number | string;
}

export async function downloadAttendanceAnalyticsExport(
  params: AttendanceAnalyticsExportParams,
): Promise<void> {
  return downloadFile({
    endpoint: `${analyticsRoot}/attendance/report/export`,
    params: omitEmpty(params as Record<string, unknown>),
    fallbackFilename: "attendance-analytics.xlsx",
  });
}

interface AttendanceHoursExportParams {
  startDate?: string;
  endDate?: string;
  classroomId?: number | string;
  studentId?: number | string;
  [key: string]: unknown;
}

export async function downloadAttendanceHoursExport(
  params: AttendanceHoursExportParams,
): Promise<void> {
  return downloadFile({
    endpoint: `${analyticsRoot}/attendance/hours/export`,
    params: omitEmpty(params as Record<string, unknown>),
    fallbackFilename: "attendance-hours.xlsx",
  });
}

interface AdminStudentReportExportParams {
  type: "activities" | "learning";
  startDate?: string;
  endDate?: string;
  classroomId?: number | string;
  studentId?: number | string;
  staffId?: number | string;
  [key: string]: unknown;
}

export async function downloadAdminStudentReportExport(
  params: AdminStudentReportExportParams,
): Promise<void> {
  const fallback =
    params.type === "learning" ? "children-learning.xlsx" : "children-activities.xlsx";
  return downloadFile({
    endpoint: `${analyticsRoot}/reports/students/export`,
    params: omitEmpty(params as Record<string, unknown>),
    fallbackFilename: fallback,
  });
}

interface AdminStaffReportExportParams {
  startDate?: string;
  endDate?: string;
  classroomId?: number | string;
  staffId?: number | string;
}

export async function downloadAdminStaffReportExport(
  params: AdminStaffReportExportParams,
): Promise<void> {
  return downloadFile({
    endpoint: `${analyticsRoot}/reports/staff/export`,
    params: omitEmpty(params as Record<string, unknown>),
    fallbackFilename: "staff-report.xlsx",
  });
}

interface FormPerformanceExportParams {
  startDate?: string;
  endDate?: string;
  periodType?: DashboardAttendancePeriodType;
}

export async function downloadFormPerformanceExport(
  params: FormPerformanceExportParams,
): Promise<void> {
  return downloadFile({
    endpoint: `${analyticsRoot}/forms/performance/export`,
    params: omitEmpty(params as Record<string, unknown>),
    fallbackFilename: "forms-performance.xlsx",
  });
}

interface StaffAttendanceAnalyticsExportParams {
  startDate?: string;
  endDate?: string;
  periodType?: DashboardAttendancePeriodType;
  staffId?: number | string;
}

export async function downloadStaffAttendanceAnalyticsExport(
  params: StaffAttendanceAnalyticsExportParams,
): Promise<void> {
  return downloadFile({
    endpoint: `${analyticsRoot}/attendance/staff/analytics/export`,
    params: omitEmpty(params as Record<string, unknown>),
    fallbackFilename: "staff-attendance-analytics.xlsx",
  });
}
