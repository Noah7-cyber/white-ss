import express, { NextFunction, Request, Response } from "express";
import {
  authenticate,
  AuthenticatedRequest,
  requireSystemAdmin,
  securityHeaders,
  requestLogger,
} from "../../../auth/middleware/middleware";
import { handleValidationErrors } from "../../../shared/middleware/validation";
import { systemAdminStaffController } from "../controllers/system-admin-staff.controller";
import {
  validateListSystemAdminStaffQuery,
  validateStaffId,
} from "../validation/system-admin-staff.validation";

export const systemAdminStaffRoutes = express.Router();

systemAdminStaffRoutes.use(securityHeaders);
systemAdminStaffRoutes.use(requestLogger);
systemAdminStaffRoutes.use(authenticate);
systemAdminStaffRoutes.use((req: Request, res: Response, next: NextFunction) => {
  requireSystemAdmin(req as AuthenticatedRequest, res, next);
});

systemAdminStaffRoutes.get(
  "/",
  ...validateListSystemAdminStaffQuery,
  handleValidationErrors,
  (req, res) => systemAdminStaffController.listStaff(req as AuthenticatedRequest, res),
);

systemAdminStaffRoutes.get(
  "/:id",
  ...validateStaffId,
  handleValidationErrors,
  (req, res) => systemAdminStaffController.getStaffById(req as AuthenticatedRequest, res),
);

export default systemAdminStaffRoutes;
