import express, { NextFunction, Request, Response } from "express";
import {
  authenticate,
  AuthenticatedRequest,
  requireSystemAdmin,
  securityHeaders,
  requestLogger,
} from "../../../auth/middleware/middleware";
import { handleValidationErrors } from "../../../shared/middleware/validation";
import { systemAdminSchoolController } from "../controllers/system-admin-school.controller";
import {
  validateSchoolId,
  validateListSystemAdminSchoolsQuery,
} from "../validation/system-admin-school.validation";

export const systemAdminSchoolRoutes = express.Router();

systemAdminSchoolRoutes.use(securityHeaders);
systemAdminSchoolRoutes.use(requestLogger);
systemAdminSchoolRoutes.use(authenticate);
systemAdminSchoolRoutes.use((req: Request, res: Response, next: NextFunction) => {
  requireSystemAdmin(req as AuthenticatedRequest, res, next);
});

systemAdminSchoolRoutes.get(
  "/",
  ...validateListSystemAdminSchoolsQuery,
  handleValidationErrors,
  (req, res) => systemAdminSchoolController.listSchools(req as AuthenticatedRequest, res),
);

systemAdminSchoolRoutes.get(
  "/:id",
  ...validateSchoolId,
  handleValidationErrors,
  (req, res) => systemAdminSchoolController.getSchoolById(req as AuthenticatedRequest, res),
);

export default systemAdminSchoolRoutes;
