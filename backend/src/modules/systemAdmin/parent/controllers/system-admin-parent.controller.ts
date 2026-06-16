import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { ParentStatus, RelationshipType } from "../../../shared/entities/EntityEnums";
import { systemAdminParentService } from "../services/system-admin-parent.service";
import { SYSTEM_ADMIN_PARENT_MESSAGES } from "../constants/messages";
import { SystemAdminParentSearchFilters } from "../types/system-admin-parent.types";
import { buildXlsxBuffer, sanitizeXlsxFilename, sendXlsx } from "../../../shared/utils/xlsx";

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

      const { success, message, ...data } = result;
      res.json({ success, message, data });
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

  async exportParents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status, schoolId, relationship, sortBy, sortOrder } = req.query;

      const filters: SystemAdminParentSearchFilters = {};
      if (schoolId) {
        filters.schoolId = parseInt(schoolId as string, 10);
      }
      if (status) {
        filters.status = status as ParentStatus;
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

      const parents = await systemAdminParentService.getParentsForExport(filters);

      const columns = [
        { header: "School", width: 28 },
        { header: "First Name", width: 18 },
        { header: "Last Name", width: 18 },
        { header: "Email", width: 28 },
        { header: "Phone", width: 16 },
        { header: "Relationship", width: 14 },
        { header: "Suffix", width: 10 },
        { header: "Status", width: 12 },
        { header: "Username", width: 22 },
        { header: "Address", width: 32 },
        { header: "Children Count", width: 14 },
        { header: "Children", width: 36 },
      ];

      const rows: unknown[][] = parents.map((parent: any) => {
        const children: any[] = Array.isArray(parent.children) ? parent.children : [];
        const childrenNames = children
          .map((c) => `${c?.user?.firstName ?? ""} ${c?.user?.lastName ?? ""}`.trim())
          .filter(Boolean)
          .join("; ");

        return [
          parent.school?.schoolName ?? "",
          parent.user?.firstName ?? "",
          parent.user?.lastName ?? "",
          parent.user?.email ?? "",
          parent.user?.phone ?? "",
          parent.relationship ?? "",
          parent.suffix ?? "",
          parent.status ?? "",
          parent.username ?? "",
          parent.user?.address ?? "",
          children.length,
          childrenNames,
        ];
      });

      const buffer = await buildXlsxBuffer({
        sheetName: "Parents",
        title: "Parents export",
        columns,
        rows,
      });
      const today = new Date().toISOString().split("T")[0];
      const baseName = filters.schoolId ? `school-${filters.schoolId}-parents` : "all-parents";
      const filename = `${sanitizeXlsxFilename(baseName)}-${today}.xlsx`;

      sendXlsx(res, filename, buffer);
    } catch (error) {
      console.error("System admin export parents error:", error);
      res.status(500).json({ success: false, message: SYSTEM_ADMIN_PARENT_MESSAGES.LIST_FAILED });
    }
  }
}

export const systemAdminParentController = new SystemAdminParentController();
