import { Response } from "express";
import { AuthenticatedRequest } from "../../auth/middleware/middleware";
import { logger } from "../../shared/utils/logger";
import { requireSchoolId } from "../../shared/utils/tenant-context";
import { activityLogger } from "../../shared/services/activity-logger.service";
import { StudentReportType } from "../../shared/entities/EntityEnums";
import { authorizeStudentAccess } from "../utils/authorize-student-access";
import { studentReportDeliveryService } from "../services/student-report.service";
import { activitySummaryService } from "../../attendance/services/activity-summary.service";
import { StudentReportDelivery } from "../../shared/entities/StudentReportDelivery";
import {
  buildXlsxBuffer,
  sanitizeXlsxFilename,
  sendXlsx,
} from "../../shared/utils/xlsx";

function serializeDelivery(d: StudentReportDelivery) {
  return {
    id: d.id,
    studentId: d.studentId,
    schoolId: d.schoolId,
    reportType: d.reportType,
    trigger: d.trigger,
    status: d.status,
    senderUserId: d.senderUserId ?? null,
    senderName: d.sender
      ? [d.sender.firstName, d.sender.lastName].filter(Boolean).join(" ").trim() || null
      : null,
    parentDeliveryId: d.parentDeliveryId ?? null,
    periodStart: d.periodStart,
    periodEnd: d.periodEnd,
    dateRangeLabel: d.dateRangeLabel,
    activityIds: d.activityIds ?? null,
    recipientType: d.recipientType,
    recipients: d.recipients,
    recipientCount: d.recipients?.length ?? 0,
    sentCount: d.recipients?.filter((r) => r.sent).length ?? 0,
    messageNote: d.messageNote ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export class StudentReportController {
  async listForStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (e: any) {
        res.status(400).json({ success: false, message: e?.message });
        return;
      }

      const studentId = Number(req.params["studentId"]);
      const auth = await authorizeStudentAccess(req, studentId, schoolId, {
        allowParent: true,
      });
      if (!auth.ok) {
        res.status(auth.status).json({ success: false, message: auth.message });
        return;
      }

      const { rows, total, pos, delta } = await studentReportDeliveryService.listByStudent({
        studentId,
        schoolId,
        ...(req.query["type"]
          ? { type: req.query["type"] as StudentReportType }
          : {}),
        ...(req.query["startDate"]
          ? { startDate: req.query["startDate"] as string }
          : {}),
        ...(req.query["endDate"]
          ? { endDate: req.query["endDate"] as string }
          : {}),
        ...(req.query["pos"] !== undefined && req.query["pos"] !== ""
          ? { pos: Number(req.query["pos"]) }
          : {}),
        ...(req.query["delta"] !== undefined && req.query["delta"] !== ""
          ? { delta: Number(req.query["delta"]) }
          : {}),
      });

      res.status(200).json({
        success: true,
        message: "Reports retrieved successfully",
        data: rows.map(serializeDelivery),
        pagination: { pos, delta, total },
      });
    } catch (error) {
      logger.error("Error in StudentReportController.listForStudent:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (e: any) {
        res.status(400).json({ success: false, message: e?.message });
        return;
      }

      const studentId = Number(req.params["studentId"]);
      const reportId = Number(req.params["reportId"]);
      const auth = await authorizeStudentAccess(req, studentId, schoolId, {
        allowParent: true,
      });
      if (!auth.ok) {
        res.status(auth.status).json({ success: false, message: auth.message });
        return;
      }

      const delivery = await studentReportDeliveryService.getById(reportId, schoolId);
      if (!delivery || delivery.studentId !== studentId) {
        res.status(404).json({ success: false, message: "Report not found" });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Report retrieved successfully",
        data: serializeDelivery(delivery),
      });
    } catch (error) {
      logger.error("Error in StudentReportController.getById:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async download(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (e: any) {
        res.status(400).json({ success: false, message: e?.message });
        return;
      }

      const studentId = Number(req.params["studentId"]);
      const reportId = Number(req.params["reportId"]);
      const auth = await authorizeStudentAccess(req, studentId, schoolId, {
        allowParent: true,
      });
      if (!auth.ok) {
        res.status(auth.status).json({ success: false, message: auth.message });
        return;
      }

      const delivery = await studentReportDeliveryService.getById(reportId, schoolId);
      if (!delivery || delivery.studentId !== studentId) {
        res.status(404).json({ success: false, message: "Report not found" });
        return;
      }

      const regen = await activitySummaryService.regenerateReportPdf(delivery);
      if (!regen) {
        res.status(410).json({
          success: false,
          message: "This report can no longer be regenerated (source data has been deleted)",
        });
        return;
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${regen.pdfFilename}"`
      );
      res.send(regen.pdfBuffer);
    } catch (error) {
      logger.error("Error in StudentReportController.download:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // GET /students/:studentId/reports/export
  // Returns the filtered report-delivery list for a single student as an
  // .xlsx workbook. Reuses the same query parameters as the list endpoint
  // (type, startDate, endDate) so the export reflects whatever the user is
  // currently viewing.
  async exportForStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (e: any) {
        res.status(400).json({ success: false, message: e?.message });
        return;
      }

      const studentId = Number(req.params["studentId"]);
      const auth = await authorizeStudentAccess(req, studentId, schoolId, {
        allowParent: true,
      });
      if (!auth.ok) {
        res.status(auth.status).json({ success: false, message: auth.message });
        return;
      }

      const deliveries = await studentReportDeliveryService.listForExport({
        studentId,
        schoolId,
        ...(req.query["type"]
          ? { type: req.query["type"] as StudentReportType }
          : {}),
        ...(req.query["startDate"]
          ? { startDate: req.query["startDate"] as string }
          : {}),
        ...(req.query["endDate"]
          ? { endDate: req.query["endDate"] as string }
          : {}),
      });

      const columns = [
        { header: "Report ID", width: 10 },
        { header: "Report Type", width: 22 },
        { header: "Date Range", width: 26 },
        { header: "Period Start", width: 14 },
        { header: "Period End", width: 14 },
        { header: "Trigger", width: 10 },
        { header: "Status", width: 10 },
        { header: "Sender", width: 22 },
        { header: "Recipient Type", width: 14 },
        { header: "Total Recipients", width: 14 },
        { header: "Sent", width: 8 },
        { header: "Failed", width: 8 },
        { header: "Recipient Emails", width: 36 },
        { header: "Failed Recipients", width: 36 },
        { header: "Message Note", width: 40 },
        { header: "Created At", width: 18 },
      ];

      const toDate = (value: Date | string | null | undefined): Date | null => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      };

      const formatType = (type: StudentReportType): string => {
        switch (type) {
          case StudentReportType.DAILY_ACTIVITY:
            return "Daily activity";
          case StudentReportType.WEEKLY_ACTIVITY:
            return "Weekly activity";
          case StudentReportType.SELECTED_ACTIVITIES:
            return "Selected activities";
          default:
            return String(type);
        }
      };

      const rows: unknown[][] = deliveries.map((d) => {
        const recipients = Array.isArray(d.recipients) ? d.recipients : [];
        const sent = recipients.filter((r) => r.sent);
        const failed = recipients.filter((r) => !r.sent);
        const senderName = d.sender
          ? [d.sender.firstName, d.sender.lastName]
              .filter(Boolean)
              .join(" ")
              .trim()
          : "";

        return [
          d.id,
          formatType(d.reportType),
          d.dateRangeLabel ?? "",
          toDate(d.periodStart),
          toDate(d.periodEnd),
          d.trigger ?? "",
          d.status ?? "",
          senderName,
          d.recipientType ?? "",
          recipients.length,
          sent.length,
          failed.length,
          recipients.map((r) => r.email).filter(Boolean).join("; "),
          failed
            .map((r) => `${r.email}${r.error ? ` (${r.error})` : ""}`)
            .filter(Boolean)
            .join("; "),
          d.messageNote ?? "",
          toDate(d.createdAt),
        ];
      });

      const buffer = await buildXlsxBuffer({
        sheetName: "Reports",
        title: "Student reports export",
        columns,
        rows,
      });

      const today = new Date().toISOString().split("T")[0];
      const filename = `${sanitizeXlsxFilename(
        `student-${studentId}-reports`,
      )}-${today}.xlsx`;

      return sendXlsx(res, filename, buffer);
    } catch (error) {
      logger.error("Error in StudentReportController.exportForStudent:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async resend(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (e: any) {
        res.status(400).json({ success: false, message: e?.message });
        return;
      }

      const studentId = Number(req.params["studentId"]);
      const reportId = Number(req.params["reportId"]);
      // Resend is staff/admin only - no parent override.
      const auth = await authorizeStudentAccess(req, studentId, schoolId, {
        allowParent: false,
      });
      if (!auth.ok) {
        res.status(auth.status).json({ success: false, message: auth.message });
        return;
      }

      const delivery = await studentReportDeliveryService.getById(reportId, schoolId);
      if (!delivery || delivery.studentId !== studentId) {
        res.status(404).json({ success: false, message: "Report not found" });
        return;
      }

      const result = await activitySummaryService.resendReport({
        delivery,
        senderUserId: req.user.id,
        ...(req.body.recipients ? { recipients: req.body.recipients } : {}),
        ...(Array.isArray(req.body.customEmails)
          ? { customEmails: req.body.customEmails }
          : {}),
        ...(typeof req.body.message === "string" ? { message: req.body.message } : {}),
      });

      if (result.success && result.delivery) {
        await activityLogger.log({
          userId: req.user.id,
          resource: "studentReport",
          action: "update",
          title: "Student report resent",
          description: `Resent report #${reportId} for student #${studentId} (new delivery #${result.delivery.id})`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      const status = result.success ? 200 : 422;
      res.status(status).json({
        success: result.success,
        message: result.message,
        data: result.delivery ? serializeDelivery(result.delivery) : null,
        recipients: result.recipients,
      });
    } catch (error) {
      logger.error("Error in StudentReportController.resend:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}

export const studentReportController = new StudentReportController();
