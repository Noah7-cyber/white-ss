/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { ApiMethods } from "@/utils/client";
import { getSchoolFromCookie, getToken } from "@/utils/helper";
import { downloadFile } from "@/utils/file-download";

// ========================
// STUDENT REPORT ROOT
// ========================
export const studentReportRoot = "/api/v1/students";

// ========================
// TYPES
// ========================
export type StudentReportType = "daily_activity" | "weekly_activity" | "selected_activities";
export type StudentReportTrigger = "auto" | "manual";
export type StudentReportStatus = "sent" | "partial" | "failed";
export type StudentReportRecipientType = "parents" | "custom";

export interface StudentReportRecipient {
  email: string;
  name?: string;
  sent: boolean;
  error?: string;
}

export interface StudentReportDelivery {
  id: number;
  studentId: number;
  schoolId: number;
  reportType: StudentReportType;
  trigger: StudentReportTrigger;
  status: StudentReportStatus;
  senderUserId: number | null;
  senderName: string | null;
  parentDeliveryId: number | null;
  periodStart: string;
  periodEnd: string;
  dateRangeLabel: string;
  activityIds: number[] | null;
  recipientType: StudentReportRecipientType;
  recipients: StudentReportRecipient[];
  recipientCount: number;
  sentCount: number;
  messageNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentReportListPagination {
  pos: number;
  delta: number;
  total: number;
}

export interface StudentReportListParams {
  type?: StudentReportType;
  startDate?: string;
  endDate?: string;
  pos?: number;
  delta?: number;
}

export interface StudentReportListResponse {
  success: boolean;
  message: string;
  data: StudentReportDelivery[];
  pagination: StudentReportListPagination;
}

export interface StudentReportSingleResponse {
  success: boolean;
  message: string;
  data: StudentReportDelivery;
}

export interface ResendStudentReportRequest {
  recipients?: StudentReportRecipientType;
  customEmails?: string[];
  message?: string;
}

export interface ResendStudentReportResponse {
  success: boolean;
  message: string;
  data: StudentReportDelivery;
  recipients: StudentReportRecipient[];
}

// ========================
// CONFIG: Endpoints & Methods
// ========================
const studentReportEndpoints = {
  // Placeholder so generateServices has at least one static entry; the real surface is dynamic.
  listStudentReportsBase: { path: `${studentReportRoot}`, method: ApiMethods.GET },
};

// Dynamic endpoints (require studentId / reportId)
export const studentReportDynamicEndpoints = {
  listReports: (studentId: string | number) => ({
    path: `${studentReportRoot}/${studentId}/reports`,
    method: ApiMethods.GET,
  }),
  exportReports: (studentId: string | number) => ({
    path: `${studentReportRoot}/${studentId}/reports/export`,
    method: ApiMethods.GET,
  }),
  getReport: (studentId: string | number, reportId: string | number) => ({
    path: `${studentReportRoot}/${studentId}/reports/${reportId}`,
    method: ApiMethods.GET,
  }),
  resendReport: (studentId: string | number, reportId: string | number) => ({
    path: `${studentReportRoot}/${studentId}/reports/${reportId}/resend`,
    method: ApiMethods.POST,
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

export const studentReportServices = generateServices(studentReportEndpoints);

// ========================
// FILE DOWNLOAD HELPER
// ========================

export interface DownloadStudentReportError extends Error {
  status?: number;
}

// Resolve a filename from a Content-Disposition header, falling back to the provided default.
function extractFileNameFromDisposition(
  disposition: string | undefined | null,
  fallback: string,
): string {
  if (!disposition) return fallback;

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to next strategy
    }
  }

  const plainMatch = /filename=("?)([^";]+)\1/i.exec(disposition);
  if (plainMatch?.[2]) {
    return plainMatch[2].trim();
  }

  return fallback;
}

// Download a student report PDF in the browser. The backend streams the file directly
// with a Content-Disposition header. We use axios directly (bypassing the shared client)
// so we can read the response headers for the suggested filename.
export async function downloadStudentReport(
  studentId: string | number,
  reportId: string | number,
): Promise<void> {
  const fallbackName = `report-${reportId}.pdf`;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const url = `${(apiUrl || "").replace(/\/$/, "")}${studentReportRoot}/${studentId}/reports/${reportId}/download`;

  try {
    const token = getToken();
    const school = getSchoolFromCookie();
    const headers: Record<string, string> = {
      Accept: "application/pdf",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (school?.id != null) headers.school = String(school.id);

    const response = await axios.get<Blob>(url, {
      headers,
      responseType: "blob",
    });

    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data as unknown as ArrayBuffer], { type: "application/pdf" });
    const disposition =
      (response.headers as any)?.["content-disposition"] ??
      (response.headers as any)?.get?.("content-disposition") ??
      null;
    const fileName = extractFileNameFromDisposition(disposition, fallbackName);

    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5_000);
  } catch (err: any) {
    const status: number | undefined =
      err?.response?.status ?? err?.status ?? err?.statusCode;

    // Backend returns JSON in the error body even though successful responses are PDFs.
    // When responseType is blob, parse the blob back into JSON to surface a useful message.
    let message: string | undefined;
    const errorBlob: Blob | undefined = err?.response?.data;
    if (errorBlob && typeof errorBlob.text === "function") {
      try {
        const text = await errorBlob.text();
        try {
          const parsed = JSON.parse(text);
          message = parsed?.message ?? parsed?.error;
        } catch {
          message = text || undefined;
        }
      } catch {
        // ignore parse failures and fall back to default copy
      }
    }
    message =
      message ?? err?.message ?? "Failed to download report";

    const downloadError: DownloadStudentReportError = new Error(message);
    downloadError.status = status;
    throw downloadError;
  }
}

// Download the filtered report-delivery history for a child as an Excel
// workbook. Mirrors the filters used by the list endpoint (type, startDate,
// endDate) so the export matches what the user is currently viewing.
export async function downloadChildReportsExport(
  studentId: string | number,
  params?: Record<string, string | number | undefined>,
): Promise<void> {
  const fallback = `student-${studentId}-reports-${
    new Date().toISOString().split("T")[0]
  }.xlsx`;
  await downloadFile({
    endpoint: `${studentReportRoot}/${studentId}/reports/export`,
    params,
    fallbackFilename: fallback,
  });
}
