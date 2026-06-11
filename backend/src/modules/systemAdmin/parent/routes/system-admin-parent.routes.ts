import express, { NextFunction, Request, Response } from "express";
import {
  authenticate,
  AuthenticatedRequest,
  requireSystemAdmin,
  securityHeaders,
  requestLogger,
} from "../../../auth/middleware/middleware";
import { systemAdminParentController } from "../controllers/system-admin-parent.controller";
import { handleValidationErrors } from "../../../shared/middleware/validation";
import {
  validateListParentsQuery,
  validateParentId,
} from "../validation/system-admin-parent.validation";

export const systemAdminParentRoutes = express.Router();

systemAdminParentRoutes.use(securityHeaders);
systemAdminParentRoutes.use(requestLogger);
systemAdminParentRoutes.use(authenticate);
systemAdminParentRoutes.use((req: Request, res: Response, next: NextFunction) => {
  requireSystemAdmin(req as AuthenticatedRequest, res, next);
});

systemAdminParentRoutes.get(
  "/",
  ...validateListParentsQuery,
  handleValidationErrors,
  (req, res) => systemAdminParentController.listParents(req as AuthenticatedRequest, res),
);

systemAdminParentRoutes.get(
  "/:id",
  ...validateParentId,
  handleValidationErrors,
  (req, res) => systemAdminParentController.getParentById(req as AuthenticatedRequest, res),
);

export default systemAdminParentRoutes;
