import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { systemAdminSettingsService } from "../services/system-admin-settings.service";
import { logger } from "../../../shared/utils/logger";

export class SystemAdminSettingsController {
  async getNotificationSettings(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await systemAdminSettingsService.getNotificationSettings();
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error("System admin get notification settings error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }

  async updateNotificationSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await systemAdminSettingsService.updateNotificationSettings(req.body);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error("System admin update notification settings error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }
}

export const systemAdminSettingsController = new SystemAdminSettingsController();
