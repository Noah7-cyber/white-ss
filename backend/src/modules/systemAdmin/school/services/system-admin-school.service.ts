import { Repository } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { School } from "../../../shared/entities/School";

export class SystemAdminSchoolService {
  private get schoolRepository(): Repository<School> {
    return AppDataSource.getRepository(School);
  }

  async listSchools(filters: any): Promise<any> {
    try {
      const pos = filters.pos ?? 0;
      const delta = filters.delta ?? 100;

      const qb = this.schoolRepository.createQueryBuilder("school");

      if (filters.search) {
        qb.andWhere("LOWER(school.schoolName) LIKE LOWER(:search)", { search: `%${filters.search}%` });
      }

      const sortByInput = filters.sortBy || "schoolName";
      const sortOrder = filters.sortOrder || "ASC";

      const sortFieldMap: Record<string, string> = {
        schoolName: "school.schoolName",
        createdAt: "school.createdAt",
        id: "school.id",
      };

      const sortField = sortFieldMap[sortByInput] || "school.schoolName";
      qb.orderBy(sortField, sortOrder);

      qb.skip(pos).take(delta);

      const [schools, count] = await qb.getManyAndCount();

      return {
        success: true,
        message: "Schools retrieved successfully",
        data: {
          schools: schools.map(school => ({
            id: school.id,
            schoolName: school.schoolName,
            schoolLogoUrl: school.schoolLogoUrl,
          })),
          pagination: { pos, delta, count },
        },
      };
    } catch (error) {
      console.error("System admin list schools error:", error);
      return { success: false, message: "Failed to list schools" };
    }
  }
}

export const systemAdminSchoolService = new SystemAdminSchoolService();
