import { Request, Response } from "express";
import { extractDeviceInfo } from "../../../auth/middleware/middleware";
import { systemAdminAuthService } from "../services/system-admin-auth.service";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";

export class SystemAdminAuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const deviceInfo = extractDeviceInfo(req);
      const { email, phone, password } = req.body;
      const result = await systemAdminAuthService.login({ email, phone, password }, deviceInfo);
      const statusCode = result.success ? 200 : result.httpStatus ?? 401;
      res.status(statusCode).json(result);
    } catch (error) {
      console.error("System admin login error:", error);
      res.status(500).json({
        success: false,
        message: AUTH_MESSAGES.INTERNAL_ERROR,
      });
    }
  }

  async verifyMFA(req: Request, res: Response): Promise<void> {
    try {
      const deviceInfo = extractDeviceInfo(req);
      const result = await systemAdminAuthService.verifyMFA(req.body, deviceInfo);
      const statusCode = result.success ? 200 : result.httpStatus ?? 400;
      res.status(statusCode).json(result);
    } catch (error) {
      console.error("System admin MFA verification error:", error);
      res.status(500).json({
        success: false,
        message: AUTH_MESSAGES.INTERNAL_ERROR,
      });
    }
  }
}

export const systemAdminAuthController = new SystemAdminAuthController();
