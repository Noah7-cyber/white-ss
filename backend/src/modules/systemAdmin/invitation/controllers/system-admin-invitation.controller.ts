import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { activityLogger } from "../../../shared/services/activity-logger.service";
import { systemAdminInvitationService } from "../services/system-admin-invitation.service";

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

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error("Create system admin invitation error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
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

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error("Accept system admin invitation error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }
}

export const systemAdminInvitationController = new SystemAdminInvitationController();
