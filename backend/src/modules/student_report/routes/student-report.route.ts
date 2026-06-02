import { Router } from "express";
import { authenticate } from "../../auth/middleware/middleware";
import { requirePermission } from "../../shared/middleware/rbac.middleware";
import { Resources, Action } from "../../auth/constants/role-permissions";
import { handleValidationErrors } from "../../shared/middleware/validation";
import { studentReportController } from "../controllers/student-report.controller";
import {
  validateListReports,
  validateReportPath,
  validateResendReport,
} from "../validation/student-report.validation";

// Mounted at /api/v1/students/:studentId/reports.
// :studentId is a parent-router path param, so we must enable mergeParams.
const router = Router({ mergeParams: true });

router.use(authenticate);

/**
 * @route GET /students/:studentId/reports
 * @desc List all reports that have been sent for the given child.
 * @access Admin/Staff with STUDENT view, or parents linked to the student.
 */
router.get(
  "/",
  ...validateListReports,
  handleValidationErrors,
  (req: any, res: any) => studentReportController.listForStudent(req, res)
);

/**
 * @route GET /students/:studentId/reports/export
 * @desc Export the filtered report-delivery history for the child as an .xlsx
 *       workbook. Reuses the same query params as the list endpoint
 *       (type, startDate, endDate). Declared before `/:reportId` so it isn't
 *       shadowed by the parameterized route.
 * @access Admin/Staff with STUDENT view, or parents linked to the student.
 */
router.get(
  "/export",
  ...validateListReports,
  handleValidationErrors,
  (req: any, res: any) => studentReportController.exportForStudent(req, res)
);

/**
 * @route GET /students/:studentId/reports/:reportId
 * @desc Fetch a single sent-report record (recipients, message, snapshot).
 * @access Admin/Staff with STUDENT view, or parents linked to the student.
 */
router.get(
  "/:reportId",
  ...validateReportPath,
  handleValidationErrors,
  (req: any, res: any) => studentReportController.getById(req, res)
);

/**
 * @route GET /students/:studentId/reports/:reportId/download
 * @desc Regenerate the PDF on demand from stored metadata and stream it back.
 * @access Admin/Staff with STUDENT view, or parents linked to the student.
 */
router.get(
  "/:reportId/download",
  ...validateReportPath,
  handleValidationErrors,
  (req: any, res: any) => studentReportController.download(req, res)
);

/**
 * @route POST /students/:studentId/reports/:reportId/resend
 * @desc Re-email the report. Defaults to original recipients/message; supports overrides.
 *       Records a new StudentReportDelivery row linked to the original via parentDeliveryId.
 * @access Staff/Admin only (CLASSROOM_ACTIVITY:UPDATE). Parents cannot resend.
 */
router.post(
  "/:reportId/resend",
  requirePermission({ resource: Resources.CLASSROOM_ACTIVITY, action: Action.UPDATE }),
  ...validateResendReport,
  handleValidationErrors,
  (req: any, res: any) => studentReportController.resend(req, res)
);

export { router as studentReportRoutes };
export default router;
