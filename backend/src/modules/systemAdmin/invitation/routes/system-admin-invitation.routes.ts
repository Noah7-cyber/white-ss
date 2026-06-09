import express, { NextFunction, Request, Response } from "express";
import {
  authenticate,
  AuthenticatedRequest,
  rateLimit,
  requireSystemAdmin,
  securityHeaders,
  requestLogger,
} from "../../../auth/middleware/middleware";
import { systemAdminInvitationController } from "../controllers/system-admin-invitation.controller";
import {
  acceptSystemAdminInvitationValidation,
  createSystemAdminInvitationValidation,
  handleValidationErrors,
} from "../validation/system-admin-invitation.validation";

export const systemAdminInvitationRoutes = express.Router();

systemAdminInvitationRoutes.use(securityHeaders);
systemAdminInvitationRoutes.use(requestLogger);

/**
 * Unlike school invitations (GET /invitation/validate + POST /invitation/accept, then POST /auth/register),
 * this endpoint validates the invitation token and creates the system_admin user in a single request.
 */
systemAdminInvitationRoutes.post(
  "/accept",
  rateLimit("registration"),
  ...acceptSystemAdminInvitationValidation,
  handleValidationErrors,
  systemAdminInvitationController.acceptInvitation.bind(systemAdminInvitationController),
);

systemAdminInvitationRoutes.use(authenticate);
systemAdminInvitationRoutes.use((req: Request, res: Response, next: NextFunction) => {
  requireSystemAdmin(req as AuthenticatedRequest, res, next);
});

systemAdminInvitationRoutes.post(
  "/",
  ...createSystemAdminInvitationValidation,
  handleValidationErrors,
  (req, res) => systemAdminInvitationController.createInvitation(req as AuthenticatedRequest, res),
);

export default systemAdminInvitationRoutes;
