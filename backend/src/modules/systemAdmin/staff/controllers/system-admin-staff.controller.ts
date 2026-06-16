import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { logger } from "../../../shared";
import { StaffStatus } from "../../../shared/entities/EntityEnums";
import { SYSTEM_ADMIN_STAFF_MESSAGES } from "../constants/messages";
import { systemAdminStaffService } from "../services/system-admin-staff.service";
import { SystemAdminStaffSearchFilters } from "../types/system-admin-staff.types";

function parseOptionalInt(value: unknown): number | undefined {
  if (typeof value === "undefined" || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export class SystemAdminStaffController {
  async listStaff(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const sortOrder =
        typeof req.query["sortOrder"] === "string"
          ? (req.query["sortOrder"] as string).toUpperCase() as "ASC" | "DESC"
          : undefined;

      const schoolId = parseOptionalInt(req.query["schoolId"]);
      const classroomId = parseOptionalInt(req.query["classroomId"]);
      const pos = parseOptionalInt(req.query["pos"]);
      const delta = parseOptionalInt(req.query["delta"]);

      const filters: SystemAdminStaffSearchFilters = {
        ...(req.query["search"] && { search: req.query["search"] as string }),
        ...(req.query["role"] && { role: req.query["role"] as string }),
        ...(req.query["classroom"] && { classroom: req.query["classroom"] as string }),
        ...(req.query["qualification"] && { qualification: req.query["qualification"] as string }),
        ...(req.query["status"] && { status: req.query["status"] as StaffStatus }),
        ...(typeof schoolId === "number" && { schoolId }),
        ...(typeof classroomId === "number" && { classroomId }),
        ...(typeof pos === "number" && { pos }),
        ...(typeof delta === "number" && { delta }),
        ...(req.query["sortBy"] && { sortBy: req.query["sortBy"] as string }),
        ...(sortOrder && { sortOrder }),
      };

      const result = await systemAdminStaffService.listStaff(filters);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      const { success, message, ...data } = result;
      res.status(200).json({ success, message, data });
    } catch (error) {
      logger.error("Error listing staff (system admin)", error);
      res.status(500).json({ success: false, message: SYSTEM_ADMIN_STAFF_MESSAGES.LIST_FAILED });
    }
  }

  async getStaffById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const staffId = parseInt(req.params["id"] as string, 10);

      if (Number.isNaN(staffId)) {
        res.status(400).json({ success: false, message: SYSTEM_ADMIN_STAFF_MESSAGES.INVALID_STAFF_ID });
        return;
      }

      const result = await systemAdminStaffService.getStaffById(staffId);
      const status = result.success ? 200 : result.message.includes("not found") ? 404 : 400;
      res.status(status).json(result);
    } catch (error) {
      logger.error("Error retrieving staff (system admin)", error);
      res.status(500).json({ success: false, message: SYSTEM_ADMIN_STAFF_MESSAGES.DETAIL_FAILED });
    }
  }
}

export const systemAdminStaffController = new SystemAdminStaffController();
