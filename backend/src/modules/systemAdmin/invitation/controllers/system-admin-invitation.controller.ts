import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { activityLogger } from "../../../shared/services/activity-logger.service";
import { systemAdminInvitationService } from "../services/system-admin-invitation.service";
import { SYSTEM_ADMIN_INVITATION_MESSAGES } from "../constants/messages";

export class SystemAdminInvitationController {
  async createInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { email, firstName, lastName } = req.body;
      const invitedById = req.user?.id;

      if (!invitedById) {
        res.status(401).json({ success: false, message: AUTH_MESSAGES.AUTHENTICATION_REQUIRED });
        return;
      }

      const result = await systemAdminInvitationService.createInvitation({
        email,
        firstName,
        lastName,
        invitedById,
      });

      if (result.success && req.user) {
        await activityLogger.log({
          userId: req.user.id,
          resource: "system_admin_invitation",
          action: "create",
          title: "System admin invitation sent",
          description: `Invitation sent to ${email} by ${req.user.name}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      if (!result.success) {
        const isClientError = Object.values(SYSTEM_ADMIN_INVITATION_MESSAGES).includes(result.message as any);
        const statusCode = isClientError ? 400 : 500;
        res.status(statusCode).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      console.error("\n[SystemAdminInvitationController] FATAL ERROR IN createInvitation:\n", error, "\n");
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }

  async acceptInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { token, email, firstName, lastName, password } = req.body;
      const result = await systemAdminInvitationService.acceptInvitation({
        token,
        email,
        firstName,
        lastName,
        password,
      });

      if (!result.success) {
        const isClientError = Object.values(SYSTEM_ADMIN_INVITATION_MESSAGES).includes(result.message as any);
        const statusCode = isClientError ? 400 : 500;
        res.status(statusCode).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      console.error("\n[SystemAdminInvitationController] FATAL ERROR IN acceptInvitation:\n", error, "\n");
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }
}

export const systemAdminInvitationController = new SystemAdminInvitationController();
