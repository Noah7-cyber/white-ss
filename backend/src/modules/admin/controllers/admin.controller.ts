import { Response } from "express";
import { AuthenticatedRequest } from "../../auth/middleware/middleware";
import { adminService, ListAdminsFilters } from "../services/admin.service";
import { logger } from "../../shared";
import { activityLogger } from "../../shared/services/activity-logger.service";
import { requireSchoolId, validateSchoolAccess } from "../../shared/utils/tenant-context";
import { UserRole } from "../../shared/entities/EntityEnums";

export class AdminController {
  /**
   * Verify admin via id/email + PIN. Public endpoint, school-scoped via subdomain or header.
   */
  async kioskVerify(req: any, res: Response): Promise<void> {
    try {
      const { id, pin } = req.body;

      if (!id) {
        res.status(400).json({ success: false, message: "ID is required (can be admin ID or email)" });
        return;
      }

      if (!pin) {
        res.status(400).json({ success: false, message: "PIN is required" });
        return;
      }

      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch {
        res.status(400).json({
          success: false,
          message: "School context is required for kiosk verification. Use subdomain or X-School-ID header.",
        });
        return;
      }

      const result = await adminService.kioskVerify(id, pin, schoolId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger?.error?.("Error in admin kioskVerify controller:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Set or update an admin's kiosk PIN.
   */
  async setPin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = Number(req.params["id"]);
      const { pin } = req.body;

      if (Number.isNaN(adminId)) {
        res.status(400).json({ success: false, message: "Invalid admin ID" });
        return;
      }

      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error: any) {
        res.status(400).json({ success: false, message: error?.message ?? "School context is required" });
        return;
      }

      const role = req.user?.role;
      if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) {
        res.status(403).json({ success: false, message: "Only admins can update an admin PIN" });
        return;
      }

      const result = await adminService.setPin(adminId, pin, schoolId);

      if (result.success) {
        await activityLogger.logFromRequest(req, {
          userId: req.user.id,
          resource: "admin",
          action: "update",
          title: `Admin PIN updated for admin #${adminId}`,
          metadata: { adminId },
        });
      }

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger?.error?.("Error setting admin PIN:", error);
      res.status(500).json({ success: false, message: "Failed to update admin PIN" });
    }
  }

  /**
   * List all admins for the requester's school.
   *
   * Admins and super admins receive the full admin payload. Parents and staff
   * are allowed to call this endpoint so they can populate messaging recipient
   * dropdowns (e.g. parent -> admin messaging), but receive a slimmed-down
   * response without sensitive contact/attendance information.
   */
  async listAdmins(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let schoolId: number;
      try {
        schoolId = requireSchoolId(req);
      } catch (error: any) {
        res.status(400).json({ success: false, message: error?.message ?? "School context is required" });
        return;
      }

      const role = req.user?.role;
      const allowedRoles: (UserRole | undefined)[] = [
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.STAFF,
        UserRole.PARENT,
      ];
      if (!allowedRoles.includes(role)) {
        res.status(403).json({ success: false, message: "Not authorized to list admins" });
        return;
      }

      if (req.query["schoolId"]) {
        try {
          validateSchoolAccess(req, Number(req.query["schoolId"]));
        } catch (error: any) {
          res.status(403).json({ success: false, message: error.message });
          return;
        }
      }

      const filters: ListAdminsFilters = {
        search: (req.query["search"] as string) || undefined,
        pos: req.query["pos"] !== undefined ? Number(req.query["pos"]) : undefined,
        delta: req.query["delta"] !== undefined ? Number(req.query["delta"]) : undefined,
      };

      const result = await adminService.listAdminsBySchool(schoolId, filters);

      // Non-admin callers (parents, staff) should only receive the minimal
      // fields needed to render a recipient dropdown - never email, phone,
      // school metadata, attendance, etc.
      const isAdminCaller = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
      if (result.success && Array.isArray(result.admins) && !isAdminCaller) {
        result.admins = result.admins.map((admin: any) => ({
          id: admin?.id,
          userId: admin?.userId,
          role: admin?.role,
          user: admin?.user
            ? {
                id: admin.user.id,
                firstName: admin.user.firstName,
                lastName: admin.user.lastName,
                profile: admin.user.profile
                  ? {
                      id: admin.user.profile.id,
                      suffix: admin.user.profile.suffix,
                      photo: admin.user.profile.photo,
                    }
                  : null,
              }
            : null,
        }));
      }

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger?.error?.("Error listing admins:", error);
      res.status(500).json({ success: false, message: "Failed to list admins" });
    }
  }
}

export const adminController = new AdminController();
