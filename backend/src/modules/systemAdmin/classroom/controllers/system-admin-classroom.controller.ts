import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth";
import { logger } from "../../../shared";
import { ClassroomStatus } from "../../../shared/entities";
import { systemAdminClassroomService } from "../services/system-admin-classroom.service";
import { SYSTEM_ADMIN_CLASSROOM_MESSAGES } from "../constants/messages";
import { SystemAdminClassroomListFilters } from "../types/system-admin-classroom.types";

export class SystemAdminClassroomController {
  async listClassrooms(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters: SystemAdminClassroomListFilters = {
        pos: typeof req.query["pos"] !== "undefined" ? Number(req.query["pos"]) : 0,
        delta: typeof req.query["delta"] !== "undefined" ? Number(req.query["delta"]) : 10,
      };

      if (req.query["schoolId"]) {
        filters.schoolId = Number(req.query["schoolId"]);
      }
      if (req.query["search"]) {
        filters.search = req.query["search"] as string;
      }
      if (req.query["classroomStatus"]) {
        filters.classroomStatus = req.query["classroomStatus"] as ClassroomStatus;
      }
      if (req.query["staffId"]) {
        filters.staffId = Number(req.query["staffId"]);
      }
      if (req.query["sortBy"]) {
        filters.sortBy = req.query["sortBy"] as string;
      }
      if (req.query["sortOrder"]) {
        filters.sortOrder = req.query["sortOrder"] as "ASC" | "DESC";
      }

      const result = await systemAdminClassroomService.listClassrooms(filters);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error("Error in system admin listClassrooms controller:", error);
      res.status(500).json({
        success: false,
        message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.LIST_FAILED,
      });
    }
  }

  async getClassroomById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const classroomId = parseInt(req.params["id"] as string, 10);

      if (isNaN(classroomId)) {
        res.status(400).json({
          success: false,
          message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.INVALID_CLASSROOM_ID,
        });
        return;
      }

      const result = await systemAdminClassroomService.getClassroomById(classroomId);

      if (!result.success) {
        const statusCode = result.message === SYSTEM_ADMIN_CLASSROOM_MESSAGES.CLASSROOM_NOT_FOUND ? 404 : 400;
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in system admin getClassroomById controller:", error);
      res.status(500).json({
        success: false,
        message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.DETAIL_FAILED,
      });
    }
  }
}

export const systemAdminClassroomController = new SystemAdminClassroomController();
