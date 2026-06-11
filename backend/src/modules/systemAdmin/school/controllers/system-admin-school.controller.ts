import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { systemAdminSchoolService } from "../services/system-admin-school.service";
import { SystemAdminSchoolSearchFilters } from "../types/system-admin-school.types";

export class SystemAdminSchoolController {
  async listSchools(req: AuthenticatedRequest, res: Response) {
    const filters: SystemAdminSchoolSearchFilters = {
      search: req.query["search"] as string,
      pos: req.query["pos"] ? parseInt(req.query["pos"] as string, 10) : undefined,
      delta: req.query["delta"] ? parseInt(req.query["delta"] as string, 10) : undefined,
      sortBy: req.query["sortBy"] as string,
      sortOrder: req.query["sortOrder"] as "ASC" | "DESC",
    };

    const result = await systemAdminSchoolService.listSchools(filters);
    res.status(result.success ? 200 : 400).json(result);
  }

  async getSchoolById(req: AuthenticatedRequest, res: Response) {
    const schoolId = parseInt(req.params["id"] as string, 10);
    const result = await systemAdminSchoolService.getSchoolById(schoolId);
    res.status(result.success ? 200 : 400).json(result);
  }
}

export const systemAdminSchoolController = new SystemAdminSchoolController();
