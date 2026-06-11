import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { systemAdminAdminService } from "../services/system-admin-admin.service";
import { SYSTEM_ADMIN_ADMIN_MESSAGES } from "../constants/messages";
import { SystemAdminAdminSearchFilters } from "../types/system-admin-admin.types";

export class SystemAdminAdminController {
  async listAdmins(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { schoolId, search, pos, delta, sortBy, sortOrder } = req.query;

      const filters: SystemAdminAdminSearchFilters = {
        pos: pos ? parseInt(pos as string, 10) : 0,
        delta: delta ? parseInt(delta as string, 10) : 25,
      };

      if (schoolId) {
        const parsedSchoolId = parseInt(schoolId as string, 10);
        if (!Number.isNaN(parsedSchoolId)) {
          filters.schoolId = parsedSchoolId;
        }
      }

      if (search) {
        filters.search = search as string;
      }
      if (sortBy) {
        filters.sortBy = sortBy as string;
      }
      if (sortOrder) {
        filters.sortOrder = sortOrder as "ASC" | "DESC";
      }

      const result = await systemAdminAdminService.listAdmins(filters);

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
      console.error("System admin list admins error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }

  async getAdminById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params["id"];
      const adminId = parseInt(idParam ?? "", 10);

      if (!idParam || Number.isNaN(adminId)) {
        res.status(400).json({ success: false, message: SYSTEM_ADMIN_ADMIN_MESSAGES.INVALID_ADMIN_ID });
        return;
      }

      const result = await systemAdminAdminService.getAdminById(adminId);

      if (!result.success) {
        const statusCode = result.message === SYSTEM_ADMIN_ADMIN_MESSAGES.ADMIN_NOT_FOUND ? 404 : 400;
        res.status(statusCode).json({ success: false, message: result.message });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      console.error("System admin get admin by id error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }
}

export const systemAdminAdminController = new SystemAdminAdminController();
