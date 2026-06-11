import express, { NextFunction, Request, Response } from "express";
import {
  authenticate,
  AuthenticatedRequest,
  requireSystemAdmin,
  securityHeaders,
  requestLogger,
} from "../../../auth/middleware/middleware";
import { systemAdminClassroomController } from "../controllers/system-admin-classroom.controller";
import {
  handleValidationErrors,
  validateGetClassroomById,
  validateListClassrooms,
} from "../validation/system-admin-classroom.validation";

export const systemAdminClassroomRoutes = express.Router();

systemAdminClassroomRoutes.use(securityHeaders);
systemAdminClassroomRoutes.use(requestLogger);
systemAdminClassroomRoutes.use(authenticate);
systemAdminClassroomRoutes.use((req: Request, res: Response, next: NextFunction) => {
  requireSystemAdmin(req as AuthenticatedRequest, res, next);
});

systemAdminClassroomRoutes.get(
  "/",
  ...validateListClassrooms,
  handleValidationErrors,
  (req, res) => systemAdminClassroomController.listClassrooms(req as AuthenticatedRequest, res),
);

systemAdminClassroomRoutes.get(
  "/:id",
  ...validateGetClassroomById,
  handleValidationErrors,
  (req, res) => systemAdminClassroomController.getClassroomById(req as AuthenticatedRequest, res),
);

export default systemAdminClassroomRoutes;
