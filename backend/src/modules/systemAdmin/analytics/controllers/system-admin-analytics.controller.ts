import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { systemAdminAnalyticsService } from "../services/system-admin-analytics.service";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";

export class SystemAdminAnalyticsController {
  async getDashboardAnalytics(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await systemAdminAnalyticsService.getDashboardAnalytics();

      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }

      res.json(result);
    } catch (error) {
      console.error("System admin analytics error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }
}

export const systemAdminAnalyticsController = new SystemAdminAnalyticsController();
