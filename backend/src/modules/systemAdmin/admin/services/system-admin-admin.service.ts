import { Brackets, Repository } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { Admin } from "../../../shared/entities/Admin";
import { AdminRole } from "../../../shared/entities/EntityEnums";
import { adminService } from "../../../admin/services/admin.service";
import { SYSTEM_ADMIN_ADMIN_MESSAGES } from "../constants/messages";
import {
  SystemAdminAdminDetailResult,
  SystemAdminAdminListItem,
  SystemAdminAdminListResult,
  SystemAdminAdminSearchFilters,
} from "../types/system-admin-admin.types";

export class SystemAdminAdminService {
  private get adminRepository(): Repository<Admin> {
    return AppDataSource.getRepository(Admin);
  }

  async listAdmins(filters: SystemAdminAdminSearchFilters): Promise<SystemAdminAdminListResult> {
    try {
      const pos = filters.pos ?? 0;
      const delta = filters.delta ?? 25;

      const qb = this.adminRepository
        .createQueryBuilder("admin")
        .leftJoinAndSelect("admin.user", "user")
        .leftJoinAndSelect("user.profile", "profile")
        .where("admin.deletedAt IS NULL")
        .andWhere("admin.role = :role", { role: AdminRole.ADMIN });

      if (filters.schoolId) {
        qb.andWhere("admin.schoolId = :schoolId", { schoolId: filters.schoolId });
      }

      if (filters.search) {
        qb.andWhere(
          new Brackets((q) => {
            q.where("LOWER(user.firstName) LIKE LOWER(:search)", { search: `%${filters.search}%` })
              .orWhere("LOWER(user.lastName) LIKE LOWER(:search)", { search: `%${filters.search}%` })
              .orWhere("LOWER(user.email) LIKE LOWER(:search)", { search: `%${filters.search}%` });
          }),
        );
      }

      const sortByInput = filters.sortBy || "createdAt";
      const sortOrder = filters.sortOrder || "DESC";

      const sortFieldMap: Record<string, string> = {
        firstName: "user.firstName",
        firstname: "user.firstName",
        lastName: "user.lastName",
        lastname: "user.lastName",
        email: "user.email",
        createdAt: "admin.createdAt",
        createdat: "admin.createdAt",
        id: "admin.id",
      };

      const sortField = sortFieldMap[sortByInput] || "admin.createdAt";
      qb.orderBy(sortField, sortOrder);

      if (sortField.includes("user.lastName")) {
        qb.addOrderBy("user.firstName", sortOrder);
      } else if (sortField.includes("user.firstName")) {
        qb.addOrderBy("user.lastName", sortOrder);
      }

      qb.skip(pos).take(delta);

      const [admins, count] = await qb.getManyAndCount();

      return {
        success: true,
        message: SYSTEM_ADMIN_ADMIN_MESSAGES.LIST_SUCCESS,
        data: {
          admins: admins.map((admin) => this.formatListItem(admin)),
          pagination: { pos, delta, count },
        },
      };
    } catch (error) {
      console.error("System admin list admins error:", error);
      return { success: false, message: SYSTEM_ADMIN_ADMIN_MESSAGES.LIST_FAILED };
    }
  }

  async getAdminById(adminId: number): Promise<SystemAdminAdminDetailResult> {
    try {
      const result = await adminService.getAdminById(adminId);

      if (!result.success || !result.admin) {
        return { success: false, message: SYSTEM_ADMIN_ADMIN_MESSAGES.ADMIN_NOT_FOUND };
      }

      return {
        success: true,
        message: SYSTEM_ADMIN_ADMIN_MESSAGES.DETAIL_SUCCESS,
        data: result.admin as Record<string, unknown>,
      };
    } catch (error) {
      console.error("System admin get admin by id error:", error);
      return { success: false, message: SYSTEM_ADMIN_ADMIN_MESSAGES.DETAIL_FAILED };
    }
  }

  private formatListItem(admin: Admin): SystemAdminAdminListItem {
    return {
      id: admin.id,
      userId: admin.userId,
      schoolId: admin.schoolId,
      role: admin.role,
      user: admin.user
        ? {
            id: admin.user.id,
            firstName: admin.user.firstName,
            lastName: admin.user.lastName,
            email: admin.user.email,
            profile: admin.user.profile?.photo
              ? { photo: admin.user.profile.photo }
              : admin.user.profile
                ? { photo: undefined }
                : null,
          }
        : null,
    };
  }
}

export const systemAdminAdminService = new SystemAdminAdminService();
