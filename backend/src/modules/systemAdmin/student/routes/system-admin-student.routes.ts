import express, { NextFunction, Request, Response } from "express";
import {
  authenticate,
  AuthenticatedRequest,
  requireSystemAdmin,
  securityHeaders,
  requestLogger,
} from "../../../auth/middleware/middleware";
import { handleValidationErrors } from "../../../shared/middleware/validation";
import { systemAdminStudentController } from "../controllers/system-admin-student.controller";
import {
  validateListStudentsQuery,
  validateStudentId,
} from "../validation/system-admin-student.validation";

export const systemAdminStudentRoutes = express.Router();

systemAdminStudentRoutes.use(securityHeaders);
systemAdminStudentRoutes.use(requestLogger);
systemAdminStudentRoutes.use(authenticate);
systemAdminStudentRoutes.use((req: Request, res: Response, next: NextFunction) => {
  requireSystemAdmin(req as AuthenticatedRequest, res, next);
});

systemAdminStudentRoutes.get(
  "/",
  ...validateListStudentsQuery,
  handleValidationErrors,
  (req, res) => systemAdminStudentController.listStudents(req as AuthenticatedRequest, res),
);

systemAdminStudentRoutes.get(
  "/export",
  ...validateListStudentsQuery,
  handleValidationErrors,
  (req, res) => systemAdminStudentController.exportStudents(req as AuthenticatedRequest, res),
);

systemAdminStudentRoutes.get(
  "/:id",
  ...validateStudentId,
  handleValidationErrors,
  (req, res) => systemAdminStudentController.getStudentById(req as AuthenticatedRequest, res),
);

export default systemAdminStudentRoutes;
