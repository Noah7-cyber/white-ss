import { Repository, IsNull } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { School } from "../../../shared/entities/School";
import { Student } from "../../../shared/entities/StudentEntity";
import { Staff } from "../../../shared/entities/Staff";
import { Classroom } from "../../../shared/entities/Classroom";
import { Parent } from "../../../shared/entities/Parent";

export class SystemAdminAnalyticsService {
  private get schoolRepository(): Repository<School> {
    return AppDataSource.getRepository(School);
  }
  private get studentRepository(): Repository<Student> {
    return AppDataSource.getRepository(Student);
  }
  private get staffRepository(): Repository<Staff> {
    return AppDataSource.getRepository(Staff);
  }
  private get classroomRepository(): Repository<Classroom> {
    return AppDataSource.getRepository(Classroom);
  }
  private get parentRepository(): Repository<Parent> {
    return AppDataSource.getRepository(Parent);
  }

  async getDashboardAnalytics(): Promise<any> {
    try {
      const totalSchools = await this.schoolRepository.count();
      const totalStudents = await this.studentRepository.count({ where: { deletedAt: IsNull() } });
      const totalTeachers = await this.staffRepository.count({ where: { deletedAt: IsNull() } });
      const totalClassrooms = await this.classroomRepository.count({ where: { deletedAt: IsNull() } });
      const totalParents = await this.parentRepository.count({ where: { deletedAt: IsNull() } });

      return {
        success: true,
        message: "System Admin Dashboard Analytics retrieved successfully",
        data: {
          totalSchools,
          totalStudents,
          totalTeachers,
          totalClassrooms,
          totalParents,
        },
      };
    } catch (error) {
      console.error("System admin dashboard analytics error:", error);
      return { success: false, message: "Failed to retrieve system admin dashboard analytics" };
    }
  }
}

export const systemAdminAnalyticsService = new SystemAdminAnalyticsService();
