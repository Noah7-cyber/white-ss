import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { ParentStatus, RelationshipType } from "../../../shared/entities/EntityEnums";
import { systemAdminParentService } from "../services/system-admin-parent.service";
import { SYSTEM_ADMIN_PARENT_MESSAGES } from "../constants/messages";
import { SystemAdminParentSearchFilters } from "../types/system-admin-parent.types";

export class SystemAdminParentController {
  async listParents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status, schoolId, relationship, pos, delta, sortBy, sortOrder } = req.query;

      const filters: SystemAdminParentSearchFilters = {
        pos: pos ? parseInt(pos as string, 10) : 0,
        delta: delta ? parseInt(delta as string, 10) : 10,
      };

      if (status) {
        filters.status = status as ParentStatus;
      }
      if (schoolId) {
        filters.schoolId = parseInt(schoolId as string, 10);
      }
      if (relationship) {
        filters.relationship = relationship as RelationshipType;
      }
      if (sortBy) {
        filters.sortBy = sortBy as string;
      }
      if (sortOrder) {
        filters.sortOrder = sortOrder as "ASC" | "DESC";
      }

      const result = await systemAdminParentService.listParents(filters);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("System admin list parents error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }

  async getParentById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params["id"];
      const parentId = parseInt(idParam ?? "", 10);

      if (!idParam || Number.isNaN(parentId)) {
        res.status(400).json({ success: false, message: SYSTEM_ADMIN_PARENT_MESSAGES.INVALID_PARENT_ID });
        return;
      }

      const result = await systemAdminParentService.getParentById(parentId);

      if (!result.success) {
        const statusCode = result.message === SYSTEM_ADMIN_PARENT_MESSAGES.PARENT_NOT_FOUND ? 404 : 400;
        res.status(statusCode).json({ success: false, message: result.message });
        return;
      }

      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error("System admin get parent by id error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }
}

export const systemAdminParentController = new SystemAdminParentController();
