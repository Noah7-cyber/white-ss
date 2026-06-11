import { Repository } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { School } from "../../../shared/entities/School";
import { SYSTEM_ADMIN_SCHOOL_MESSAGES } from "../constants/messages";
import {
  SystemAdminSchoolDetailResult,
  SystemAdminSchoolListResult,
  SystemAdminSchoolSearchFilters,
} from "../types/system-admin-school.types";

export class SystemAdminSchoolService {
  private get schoolRepository(): Repository<School> {
    return AppDataSource.getRepository(School);
  }

  async listSchools(filters: SystemAdminSchoolSearchFilters): Promise<SystemAdminSchoolListResult> {
    try {
      const pos = filters.pos ?? 0;
      const delta = filters.delta ?? 25;

      const qb = this.schoolRepository
        .createQueryBuilder("school")
        .where("1 = 1");

      if (filters.search) {
        qb.andWhere("LOWER(school.schoolName) LIKE LOWER(:search)", { search: `%${filters.search}%` });
      }

      const sortByInput = filters.sortBy || "createdAt";
      const sortOrder = filters.sortOrder || "DESC";

      const sortFieldMap: Record<string, string> = {
        schoolName: "school.schoolName",
        schoolname: "school.schoolName",
        createdAt: "school.createdAt",
        createdat: "school.createdAt",
        id: "school.id",
      };

      const sortField = sortFieldMap[sortByInput] || "school.createdAt";
      qb.orderBy(sortField, sortOrder);

      qb.skip(pos).take(delta);

      const [schools, count] = await qb.getManyAndCount();

      return {
        success: true,
        message: SYSTEM_ADMIN_SCHOOL_MESSAGES.LIST_SUCCESS,
        data: {
          schools: schools,
          pagination: { pos, delta, count },
        },
      };
    } catch (error) {
      console.error("System admin list schools error:", error);
      return { success: false, message: SYSTEM_ADMIN_SCHOOL_MESSAGES.LIST_FAILED };
    }
  }

  async getSchoolById(schoolId: number): Promise<SystemAdminSchoolDetailResult> {
    try {
      const school = await this.schoolRepository.findOne({ where: { id: schoolId } });

      if (!school) {
        return { success: false, message: SYSTEM_ADMIN_SCHOOL_MESSAGES.SCHOOL_NOT_FOUND };
      }

      return {
        success: true,
        message: SYSTEM_ADMIN_SCHOOL_MESSAGES.DETAIL_SUCCESS,
        data: school as unknown as Record<string, unknown>,
      };
    } catch (error) {
      console.error("System admin get school by id error:", error);
      return { success: false, message: SYSTEM_ADMIN_SCHOOL_MESSAGES.DETAIL_FAILED };
    }
  }
}

export const systemAdminSchoolService = new SystemAdminSchoolService();
