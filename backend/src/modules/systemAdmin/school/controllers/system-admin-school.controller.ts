import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { systemAdminSchoolService } from "../services/system-admin-school.service";

export class SystemAdminSchoolController {
  async listSchools(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pos, delta, search, sortBy, sortOrder } = req.query;

      const filters: any = {
        pos: pos ? parseInt(pos as string, 10) : 0,
        delta: delta ? parseInt(delta as string, 10) : 100,
      };

      if (search) {
        filters.search = search as string;
      }
      if (sortBy) {
        filters.sortBy = sortBy as string;
      }
      if (sortOrder) {
        filters.sortOrder = sortOrder as "ASC" | "DESC";
      }

      const result = await systemAdminSchoolService.listSchools(filters);

      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      console.error("System admin list schools error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }
}

export const systemAdminSchoolController = new SystemAdminSchoolController();
