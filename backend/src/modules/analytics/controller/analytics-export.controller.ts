/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from "express";
import { AuthenticatedRequest } from "../../auth/middleware/middleware";
import {
  AnalyticsService,
  type AttendanceReportType,
  type AdminStudentReportType,
} from "../service/analytics.service";
import { studentAttendanceService } from "../../attendance/services/student-attendance.service";
import { logger } from "../../shared/utils/logger";
import { requireSchoolId } from "../../shared/utils/tenant-context";
import { InvoiceStatus, AttendanceStatus } from "../../shared/entities/EntityEnums";
import {
  buildXlsxBuffer,
  buildMultiSheetXlsxBuffer,
  sanitizeXlsxFilename,
  sendXlsx,
  XlsxColumn,
  XlsxSheet,
} from "../../shared/utils/xlsx";

// Cap how many rows a single export can pull. Generous enough to cover any
// realistic school-wide month/year filter, low enough to keep memory in check.
const EXPORT_LIMIT = 10_000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayStamp(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildSchoolError(error: unknown): { status: number; message: string } {
  const err = error as { message?: string };
  return { status: 400, message: err?.message || "School ID not found" };
}

export class AnalyticsExportController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  // ============================================================
  // Billings — deposit / transaction
  // GET /api/v1/analytics/billing/export?type=deposit|transaction
  // ============================================================
  async exportBillingReport(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error) {
        const { status, message } = buildSchoolError(error);
        return res.status(status).json({ success: false, message });
      }

      const rawType = req.query["type"] as string;
      const type: "deposit" | "transaction" = rawType === "transaction" ? "transaction" : "deposit";

      const filters = {
        schoolId,
        startDate: req.query["startDate"] as string | undefined,
        endDate: req.query["endDate"] as string | undefined,
        classroomId: req.query["classroomId"] ? Number(req.query["classroomId"]) : undefined,
        studentId: req.query["studentId"] ? Number(req.query["studentId"]) : undefined,
        parentId: req.query["parentId"] ? Number(req.query["parentId"]) : undefined,
        status: req.query["status"] as InvoiceStatus | undefined,
        pos: 0,
        delta: EXPORT_LIMIT,
      };

      if (type === "transaction") {
        const result = await this.analyticsService.getBillingTransactions(filters);
        if (!result.success) return res.status(500).json(result);

        const columns: XlsxColumn[] = [
          { header: "Child Name", width: 24 },
          { header: "Parent Name", width: 24 },
          { header: "Payment Date", width: 14 },
          { header: "Description", width: 32 },
          { header: "Amount Paid", width: 16 },
        ];
        const rows = (result.data ?? []).map((row: any) => [
          asString(row.studentName),
          asString(row.parentName),
          toDate(row.paymentDate),
          asString(row.description),
          asNumber(row.amountPaid),
        ]);

        const buffer = await buildXlsxBuffer({
          sheetName: "Transactions",
          title: "Transactions report",
          columns,
          rows,
        });
        return sendXlsx(
          res,
          `${sanitizeXlsxFilename("billing-transactions")}-${todayStamp()}.xlsx`,
          buffer,
        );
      }

      const result = await this.analyticsService.getBillingDeposits(filters);
      if (!result.success) return res.status(500).json(result);

      const columns: XlsxColumn[] = [
        { header: "Child Name", width: 24 },
        { header: "Parent Name", width: 24 },
        { header: "Issue Date", width: 14 },
        { header: "Due Date", width: 14 },
        { header: "Description", width: 32 },
        { header: "Status", width: 14 },
        { header: "Total Fees", width: 16 },
        { header: "Amount Deposited", width: 18 },
      ];
      const rows = (result.data ?? []).map((row: any) => [
        asString(row.studentName),
        asString(row.parentName),
        toDate(row.issueDate),
        toDate(row.dueDate),
        asString(row.description),
        asString(row.status).replace(/_/g, " "),
        asNumber(row.totalFees),
        asNumber(row.amountDeposited),
      ]);

      const buffer = await buildXlsxBuffer({
        sheetName: "Deposits",
        title: "Deposits report",
        columns,
        rows,
      });
      return sendXlsx(
        res,
        `${sanitizeXlsxFilename("billing-deposits")}-${todayStamp()}.xlsx`,
        buffer,
      );
    } catch (error) {
      logger.error("Error in exportBillingReport:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // ============================================================
  // Billings summary (rolled up by student)
  // GET /api/v1/analytics/billing/summary/export
  // ============================================================
  async exportBillingSummary(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error) {
        const { status, message } = buildSchoolError(error);
        return res.status(status).json({ success: false, message });
      }

      const filters = {
        schoolId,
        startDate: req.query["startDate"] as string | undefined,
        endDate: req.query["endDate"] as string | undefined,
        classroomId: req.query["classroomId"] ? Number(req.query["classroomId"]) : undefined,
        studentId: req.query["studentId"] ? Number(req.query["studentId"]) : undefined,
        parentId: req.query["parentId"] ? Number(req.query["parentId"]) : undefined,
        status: req.query["status"] as InvoiceStatus | undefined,
        pos: 0,
        delta: EXPORT_LIMIT,
      };

      const result = await this.analyticsService.getBillingSummary(filters);
      if (!result.success) return res.status(500).json(result);

      const summaryColumns: XlsxColumn[] = [
        { header: "Child Name", width: 24 },
        { header: "Parent Name", width: 24 },
        { header: "Invoice Dates", width: 30 },
        { header: "Invoices Issued", width: 16 },
        { header: "Total Invoiced", width: 16 },
        { header: "Outstanding Balance", width: 18 },
        { header: "Paid", width: 14 },
      ];
      const summaryRows = (result.data ?? []).map((row: any) => [
        asString(row.studentName),
        asString(row.parentName),
        Array.isArray(row.invoiceDates) ? row.invoiceDates.join("; ") : "",
        asNumber(row.invoicesIssued),
        asNumber(row.totalInvoiceAmount),
        asNumber(row.outstandingBalance),
        asNumber(row.paid),
      ]);

      const totalsColumns: XlsxColumn[] = [
        { header: "Metric", width: 32 },
        { header: "Value", width: 20 },
      ];
      const m = result.metadata ?? {
        totalOutstandingBalanceAmount: 0,
        totalOutstandingBalanceCount: 0,
        totalAmount: 0,
        totalPaidAmount: 0,
      };
      const totalsRows: unknown[][] = [
        ["Total invoiced amount", m.totalAmount],
        ["Total paid amount", m.totalPaidAmount],
        ["Outstanding balance amount", m.totalOutstandingBalanceAmount],
        ["Outstanding balance count", m.totalOutstandingBalanceCount],
      ];

      const sheets: XlsxSheet[] = [
        { name: "Summary", columns: summaryColumns, rows: summaryRows },
        { name: "Totals", columns: totalsColumns, rows: totalsRows },
      ];

      const buffer = await buildMultiSheetXlsxBuffer({
        sheets,
        title: "Billing summary",
      });
      return sendXlsx(
        res,
        `${sanitizeXlsxFilename("billing-summary")}-${todayStamp()}.xlsx`,
        buffer,
      );
    } catch (error) {
      logger.error("Error in exportBillingSummary:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // ============================================================
  // Attendance check-in/out + classrooms
  // GET /api/v1/analytics/reports/attendance/export?type=check-in-out|classrooms
  // ============================================================
  async exportAttendanceReport(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error) {
        const { status, message } = buildSchoolError(error);
        return res.status(status).json({ success: false, message });
      }

      const type = (req.query["type"] as AttendanceReportType) || "check-in-out";
      const filters = {
        schoolId,
        type,
        classroomId: req.query["classroomId"] ? Number(req.query["classroomId"]) : undefined,
        status: req.query["status"] as AttendanceStatus | undefined,
        startDate: req.query["startDate"] as string | undefined,
        endDate: req.query["endDate"] as string | undefined,
        pos: 0,
        delta: EXPORT_LIMIT,
      };

      const result = await this.analyticsService.getAttendanceReport(filters);
      if (!result.success) return res.status(500).json(result);

      if (type === "classrooms") {
        const columns: XlsxColumn[] = [
          { header: "Classroom", width: 24 },
          { header: "Students In", width: 14 },
          { header: "Staff In", width: 12 },
          { header: "Ratio", width: 12 },
        ];
        const rows = (result.data ?? []).map((row: any) => [
          asString(row.className),
          asNumber(row.studentsIn),
          asNumber(row.staffIn),
          asString(row.ratio),
        ]);
        const buffer = await buildXlsxBuffer({
          sheetName: "Classroom attendance",
          title: "Classroom attendance",
          columns,
          rows,
        });
        return sendXlsx(
          res,
          `${sanitizeXlsxFilename("attendance-classrooms")}-${todayStamp()}.xlsx`,
          buffer,
        );
      }

      const columns: XlsxColumn[] = [
        { header: "Child Name", width: 24 },
        { header: "Time In", width: 14 },
        { header: "Time Out", width: 14 },
        { header: "Reason / Note", width: 32 },
        { header: "Status", width: 12 },
      ];
      const rows = (result.data ?? []).map((row: any) => [
        asString(row.childName),
        asString(row.timeIn),
        asString(row.timeOut),
        asString(row.reasonNote),
        asString(row.status),
      ]);
      const buffer = await buildXlsxBuffer({
        sheetName: "Check in/out",
        title: "Attendance check in/out",
        columns,
        rows,
      });
      return sendXlsx(
        res,
        `${sanitizeXlsxFilename("attendance-check-in-out")}-${todayStamp()}.xlsx`,
        buffer,
      );
    } catch (error) {
      logger.error("Error in exportAttendanceReport:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // ============================================================
  // Attendance hours — per-student totals (mirrors the Reports
  // -> Attendance -> Hours page, which is fed by the student
  // attendance summary endpoint, not the analytics aggregation).
  // GET /api/v1/analytics/attendance/hours/export
  // ============================================================
  async exportAttendanceHours(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error) {
        const { status, message } = buildSchoolError(error);
        return res.status(status).json({ success: false, message });
      }

      const result = await studentAttendanceService.getStudentAttendanceSummary({
        schoolId,
        startDate: req.query["startDate"] as string | undefined,
        endDate: req.query["endDate"] as string | undefined,
        classroomId: req.query["classroomId"] ? Number(req.query["classroomId"]) : undefined,
        studentId: req.query["studentId"] ? Number(req.query["studentId"]) : undefined,
        pos: 0,
        delta: EXPORT_LIMIT,
      });
      if (!result.success) return res.status(500).json(result);

      const summaries = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];

      const columns: XlsxColumn[] = [
        { header: "Child", width: 26 },
        { header: "Admission #", width: 16 },
        { header: "Total Present Hours", width: 18 },
        { header: "Total Absent Hours", width: 18 },
        { header: "Present Days", width: 14 },
        { header: "Absent Days", width: 14 },
        { header: "Late Days", width: 12 },
        { header: "Excused Days", width: 14 },
        { header: "Leave Days", width: 12 },
        { header: "Potential School Days", width: 18 },
      ];
      const rows = summaries.map((row: any) => [
        asString(row.studentName),
        asString(row.admissionNumber),
        asNumber(row.totalPresentHours),
        asNumber(row.totalAbsentHours),
        asNumber(row.presentDays),
        asNumber(row.absentDays),
        asNumber(row.lateDays),
        asNumber(row.excusedDays),
        asNumber(row.leaveDays),
        asNumber(row.potentialSchoolDays),
      ]);

      const buffer = await buildXlsxBuffer({
        sheetName: "Attendance hours",
        title: "Attendance hours report",
        columns,
        rows,
      });
      return sendXlsx(
        res,
        `${sanitizeXlsxFilename("attendance-hours")}-${todayStamp()}.xlsx`,
        buffer,
      );
    } catch (error) {
      logger.error("Error in exportAttendanceHours:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // ============================================================
  // Attendance analytics dashboard — multi-sheet, mirrors the
  // /admin/attendance/reports + /staff/attendance/reports views.
  // GET /api/v1/analytics/attendance/report/export
  // ============================================================
  async exportAttendanceAnalytics(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<Response | void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error) {
        const { status, message } = buildSchoolError(error);
        return res.status(status).json({ success: false, message });
      }

      const filters = {
        schoolId,
        startDate: req.query["startDate"] as string | undefined,
        endDate: req.query["endDate"] as string | undefined,
        periodType: req.query["periodType"] as
          | "daily"
          | "weekly"
          | "monthly"
          | "yearly"
          | undefined,
      };

      const result = await this.analyticsService.getAttendanceAnalytics(filters);
      if (!result.success || !result.data) return res.status(500).json(result);

      const data: any = result.data;
      const sheets: XlsxSheet[] = [];

      sheets.push({
        name: "Summary",
        columns: [
          { header: "Metric", width: 32 },
          { header: "Value", width: 28 },
        ],
        rows: [
          ["Overall attendance rate (%)", asNumber(data.overallAttendanceRate)],
          ["Lateness rate (%)", asNumber(data.latenessRate)],
          [
            "Most present class",
            `${asString(data.mostPresentClass?.className)} (${asString(data.mostPresentClass?.rate)}%)`,
          ],
          [
            "Highest absentee class",
            `${asString(data.highestAbsenteeClass?.className)} (${asString(data.highestAbsenteeClass?.rate)}%)`,
          ],
        ],
      });

      const trend = data.attendanceTrend;
      if (trend?.xAxis?.length) {
        sheets.push({
          name: "Trend",
          columns: [
            { header: "Period", width: 20 },
            { header: "Present", width: 12 },
            { header: "Absent", width: 12 },
            { header: "Late", width: 12 },
          ],
          rows: trend.xAxis.map((label: string, idx: number) => [
            asString(label),
            asNumber(trend.present?.[idx]),
            asNumber(trend.absent?.[idx]),
            asNumber(trend.late?.[idx]),
          ]),
        });
      }

      const byStudent = data.attendanceByStudent;
      if (byStudent?.xAxis?.length) {
        sheets.push({
          name: "By student",
          columns: [
            { header: "Child", width: 26 },
            { header: "Present", width: 12 },
            { header: "Absent", width: 12 },
            { header: "Late", width: 12 },
          ],
          rows: byStudent.xAxis.map((label: string, idx: number) => [
            asString(label),
            asNumber(byStudent.present?.[idx]),
            asNumber(byStudent.absent?.[idx]),
            asNumber(byStudent.late?.[idx]),
          ]),
        });
      }

      const distribution = data.statusDistribution;
      if (distribution?.xAxis?.length) {
        sheets.push({
          name: "Status distribution",
          columns: [
            { header: "Status", width: 18 },
            { header: "Count", width: 12 },
            { header: "Percentage (%)", width: 16 },
          ],
          rows: distribution.xAxis.map((label: string, idx: number) => [
            asString(label),
            asNumber(distribution.yAxis?.[idx]),
            asNumber(distribution.percentages?.[idx]),
          ]),
        });
      }

      if (sheets.length === 0) {
        sheets.push({
          name: "Summary",
          columns: [{ header: "Notice", width: 40 }],
          rows: [["No data available for the selected range"]],
        });
      }

      const buffer = await buildMultiSheetXlsxBuffer({
        sheets,
        title: "Attendance analytics",
      });
      return sendXlsx(
        res,
        `${sanitizeXlsxFilename("attendance-analytics")}-${todayStamp()}.xlsx`,
        buffer,
      );
    } catch (error) {
      logger.error("Error in exportAttendanceAnalytics:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // ============================================================
  // Admin student reports (activities | learning)
  // GET /api/v1/analytics/reports/students/export?type=activities|learning
  // ============================================================
  async exportAdminStudentReport(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<Response | void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error) {
        const { status, message } = buildSchoolError(error);
        return res.status(status).json({ success: false, message });
      }

      const type = (req.query["type"] as AdminStudentReportType) || "activities";
      const result = await this.analyticsService.getAdminStudentReport({
        schoolId,
        type,
        startDate: req.query["startDate"] as string | undefined,
        endDate: req.query["endDate"] as string | undefined,
        classroomId: req.query["classroomId"] ? Number(req.query["classroomId"]) : undefined,
        studentId: req.query["studentId"] ? Number(req.query["studentId"]) : undefined,
        staffId: req.query["staffId"] ? Number(req.query["staffId"]) : undefined,
        pos: 0,
        delta: EXPORT_LIMIT,
      });
      if (!result.success) return res.status(500).json(result);

      if (type === "learning") {
        const columns: XlsxColumn[] = [
          { header: "Child", width: 24 },
          { header: "Classroom", width: 22 },
          { header: "Performance (%)", width: 16 },
          { header: "Last Assessment Date", width: 18 },
          { header: "Last Observation", width: 36 },
          { header: "Milestone", width: 24 },
          { header: "Subject", width: 18 },
        ];
        const rows = (result.data ?? []).map((row: any) => [
          asString(row.childrenName),
          asString(row.classroomName),
          asNumber(row.performancePercentage),
          toDate(row.lastAssessmentDate),
          asString(row.lastObservationSummary),
          asString(row.milestoneTitle),
          asString(row.subjectName),
        ]);
        const buffer = await buildXlsxBuffer({
          sheetName: "Learning",
          title: "Student learning report",
          columns,
          rows,
        });
        return sendXlsx(
          res,
          `${sanitizeXlsxFilename("children-learning")}-${todayStamp()}.xlsx`,
          buffer,
        );
      }

      const columns: XlsxColumn[] = [
        { header: "Child", width: 24 },
        { header: "Classroom", width: 22 },
        { header: "Date / Time", width: 18 },
        { header: "Activity Type", width: 18 },
        { header: "Notes / Description", width: 40 },
      ];
      const rows = (result.data ?? []).map((row: any) => [
        asString(row.childrenName),
        asString(row.classroomName),
        toDate(row.dateTime),
        asString(row.activityType),
        asString(row.notesOrDescription),
      ]);
      const buffer = await buildXlsxBuffer({
        sheetName: "Activities",
        title: "Student activities report",
        columns,
        rows,
      });
      return sendXlsx(
        res,
        `${sanitizeXlsxFilename("children-activities")}-${todayStamp()}.xlsx`,
        buffer,
      );
    } catch (error) {
      logger.error("Error in exportAdminStudentReport:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // ============================================================
  // Admin staff report
  // GET /api/v1/analytics/reports/staff/export
  // ============================================================
  async exportAdminStaffReport(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<Response | void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error) {
        const { status, message } = buildSchoolError(error);
        return res.status(status).json({ success: false, message });
      }

      const result = await this.analyticsService.getAdminStaffReport({
        schoolId,
        startDate: req.query["startDate"] as string | undefined,
        endDate: req.query["endDate"] as string | undefined,
        classroomId: req.query["classroomId"] ? Number(req.query["classroomId"]) : undefined,
        staffId: req.query["staffId"] ? Number(req.query["staffId"]) : undefined,
        pos: 0,
        delta: EXPORT_LIMIT,
      });
      if (!result.success) return res.status(500).json(result);

      const columns: XlsxColumn[] = [
        { header: "Staff Name", width: 26 },
        { header: "Role", width: 14 },
        { header: "Room Assignment", width: 28 },
        { header: "Timecard Hours", width: 16 },
        { header: "Total Children In Classes", width: 18 },
        { header: "Staff-To-Child Ratio", width: 56 },
      ];
      const rows = (result.data ?? []).map((row: any) => [
        asString(row.staffName),
        asString(row.role),
        asString(row.roomAssignment),
        asNumber(row.timecardHours),
        asNumber(row.totalChildrenInClasses),
        asString(row.staffToChildRatioByRoom),
      ]);
      const buffer = await buildXlsxBuffer({
        sheetName: "Staff",
        title: "Staff report",
        columns,
        rows,
      });
      return sendXlsx(
        res,
        `${sanitizeXlsxFilename("staff-report")}-${todayStamp()}.xlsx`,
        buffer,
      );
    } catch (error) {
      logger.error("Error in exportAdminStaffReport:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // ============================================================
  // Form performance (admission/forms)
  // GET /api/v1/analytics/forms/performance/export
  // ============================================================
  async exportFormPerformance(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<Response | void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error) {
        const { status, message } = buildSchoolError(error);
        return res.status(status).json({ success: false, message });
      }

      const result = await this.analyticsService.getFormPerformanceReport({
        schoolId,
        startDate: req.query["startDate"] as string | undefined,
        endDate: req.query["endDate"] as string | undefined,
        periodType:
          (req.query["periodType"] as "daily" | "weekly" | "monthly" | "yearly" | undefined) ||
          "daily",
        pos: 0,
        delta: EXPORT_LIMIT,
      });
      if (!result.success) return res.status(500).json(result);

      const columns: XlsxColumn[] = [
        { header: "Form ID", width: 10 },
        { header: "Form Name", width: 32 },
        { header: "Total Submissions", width: 16 },
        { header: "Total Accepted", width: 16 },
        { header: "Draft", width: 10 },
        { header: "Submitted", width: 10 },
        { header: "Reviewed", width: 10 },
        { header: "Accepted", width: 10 },
        { header: "Rejected", width: 10 },
      ];
      const rows = (result.data ?? []).map((row: any) => [
        asNumber(row.formId),
        asString(row.formName),
        asNumber(row.totalSubmissions),
        asNumber(row.totalAccepted),
        asNumber(row.status?.draft),
        asNumber(row.status?.submitted),
        asNumber(row.status?.reviewed),
        asNumber(row.status?.accepted),
        asNumber(row.status?.rejected),
      ]);
      const buffer = await buildXlsxBuffer({
        sheetName: "Forms",
        title: "Form performance report",
        columns,
        rows,
      });
      return sendXlsx(
        res,
        `${sanitizeXlsxFilename("forms-performance")}-${todayStamp()}.xlsx`,
        buffer,
      );
    } catch (error) {
      logger.error("Error in exportFormPerformance:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // ============================================================
  // Staff attendance dashboard (multi-sheet for nested aggregations)
  // GET /api/v1/analytics/attendance/staff/analytics/export
  // ============================================================
  async exportStaffAttendanceAnalytics(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<Response | void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error) {
        const { status, message } = buildSchoolError(error);
        return res.status(status).json({ success: false, message });
      }

      const filters = {
        schoolId,
        startDate: req.query["startDate"] as string | undefined,
        endDate: req.query["endDate"] as string | undefined,
        staffId: req.query["staffId"] ? Number(req.query["staffId"]) : undefined,
        periodType: req.query["periodType"] as
          | "daily"
          | "weekly"
          | "monthly"
          | "yearly"
          | undefined,
      };

      const result = await this.analyticsService.getStaffAttendanceAnalytics(filters);
      if (!result.success || !result.data) return res.status(500).json(result);

      const data: any = result.data;
      const sheets: XlsxSheet[] = [];

      sheets.push({
        name: "Summary",
        columns: [
          { header: "Metric", width: 32 },
          { header: "Value", width: 28 },
        ],
        rows: [
          ["Overall attendance rate (%)", asNumber(data.overallAttendanceRate)],
          ["Lateness rate (%)", asNumber(data.latenessRate)],
          [
            "Most present staff",
            `${asString(data.mostPresentStaff?.staffName)} (${asString(data.mostPresentStaff?.rate)}%)`,
          ],
          [
            "Highest absentee staff",
            `${asString(data.highestAbsenteeStaff?.staffName)} (${asString(data.highestAbsenteeStaff?.rate)}%)`,
          ],
        ],
      });

      const trend = data.attendanceTrend;
      if (trend?.xAxis?.length) {
        sheets.push({
          name: "Trend",
          columns: [
            { header: "Period", width: 20 },
            { header: "Present", width: 12 },
            { header: "Absent", width: 12 },
            { header: "Late", width: 12 },
          ],
          rows: trend.xAxis.map((label: string, idx: number) => [
            asString(label),
            asNumber(trend.present?.[idx]),
            asNumber(trend.absent?.[idx]),
            asNumber(trend.late?.[idx]),
          ]),
        });
      }

      const byStaff = data.attendanceByStaff;
      if (byStaff?.xAxis?.length) {
        sheets.push({
          name: "By staff",
          columns: [
            { header: "Staff", width: 26 },
            { header: "Present", width: 12 },
            { header: "Absent", width: 12 },
            { header: "Late", width: 12 },
          ],
          rows: byStaff.xAxis.map((label: string, idx: number) => [
            asString(label),
            asNumber(byStaff.present?.[idx]),
            asNumber(byStaff.absent?.[idx]),
            asNumber(byStaff.late?.[idx]),
          ]),
        });
      }

      const distribution = data.statusDistribution;
      if (distribution?.xAxis?.length) {
        sheets.push({
          name: "Status distribution",
          columns: [
            { header: "Status", width: 18 },
            { header: "Count", width: 12 },
            { header: "Percentage (%)", width: 16 },
          ],
          rows: distribution.xAxis.map((label: string, idx: number) => [
            asString(label),
            asNumber(distribution.yAxis?.[idx]),
            asNumber(distribution.percentages?.[idx]),
          ]),
        });
      }

      const buffer = await buildMultiSheetXlsxBuffer({
        sheets,
        title: "Staff attendance analytics",
      });
      return sendXlsx(
        res,
        `${sanitizeXlsxFilename("staff-attendance-analytics")}-${todayStamp()}.xlsx`,
        buffer,
      );
    } catch (error) {
      logger.error("Error in exportStaffAttendanceAnalytics:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}

export const analyticsExportController = new AnalyticsExportController();
