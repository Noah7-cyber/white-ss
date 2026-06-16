import express, { NextFunction, Request, Response } from "express";
import {
  authenticate,
  AuthenticatedRequest,
  requireSystemAdmin,
  securityHeaders,
  requestLogger,
} from "../../../auth/middleware/middleware";
import { handleValidationErrors } from "../../../shared/middleware/validation";
import { systemAdminSettingsController } from "../controllers/system-admin-settings.controller";

export const systemAdminSettingsRoutes = express.Router();

systemAdminSettingsRoutes.use(securityHeaders);
systemAdminSettingsRoutes.use(requestLogger);
systemAdminSettingsRoutes.use(authenticate);
systemAdminSettingsRoutes.use((req: Request, res: Response, next: NextFunction) => {
  requireSystemAdmin(req as AuthenticatedRequest, res, next);
});

systemAdminSettingsRoutes.get(
  "/notifications",
  handleValidationErrors,
  (req, res) => systemAdminSettingsController.getNotificationSettings(req as AuthenticatedRequest, res),
);

systemAdminSettingsRoutes.put(
  "/notifications",
  handleValidationErrors,
  (req, res) => systemAdminSettingsController.updateNotificationSettings(req as AuthenticatedRequest, res),
);

export default systemAdminSettingsRoutes;
