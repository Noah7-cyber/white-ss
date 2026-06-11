import express, { NextFunction, Request, Response } from "express";
import {
  authenticate,
  AuthenticatedRequest,
  requireSystemAdmin,
  securityHeaders,
  requestLogger,
} from "../../../auth/middleware/middleware";
import { handleValidationErrors } from "../../../shared/middleware/validation";
import { systemAdminAdminController } from "../controllers/system-admin-admin.controller";
import {
  validateAdminId,
  validateListSystemAdminAdminsQuery,
} from "../validation/system-admin-admin.validation";

export const systemAdminAdminRoutes = express.Router();

systemAdminAdminRoutes.use(securityHeaders);
systemAdminAdminRoutes.use(requestLogger);
systemAdminAdminRoutes.use(authenticate);
systemAdminAdminRoutes.use((req: Request, res: Response, next: NextFunction) => {
  requireSystemAdmin(req as AuthenticatedRequest, res, next);
});

systemAdminAdminRoutes.get(
  "/",
  ...validateListSystemAdminAdminsQuery,
  handleValidationErrors,
  (req, res) => systemAdminAdminController.listAdmins(req as AuthenticatedRequest, res),
);

systemAdminAdminRoutes.get(
  "/:id",
  ...validateAdminId,
  handleValidationErrors,
  (req, res) => systemAdminAdminController.getAdminById(req as AuthenticatedRequest, res),
);

export default systemAdminAdminRoutes;
