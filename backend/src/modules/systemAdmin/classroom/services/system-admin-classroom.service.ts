import { AppDataSource } from "../../../core";
import { Classroom } from "../../../shared/entities/Classroom";
import { logger } from "../../../shared";
import { classroomService } from "../../../classroom/services/classroom.service";
import { SYSTEM_ADMIN_CLASSROOM_MESSAGES } from "../constants/messages";
import {
  SystemAdminClassroomDetailResponse,
  SystemAdminClassroomListFilters,
  SystemAdminClassroomListResponse,
} from "../types/system-admin-classroom.types";

export class SystemAdminClassroomService {
  private get classroomRepository() {
    return AppDataSource.getRepository(Classroom);
  }

  private async resolveFormattedClassrooms(classrooms: Classroom[]): Promise<Classroom[]> {
    const results = await Promise.all(
      classrooms.map((classroom) => classroomService.getClassroomById(classroom.id)),
    );

    return results
      .filter((result) => result.success && result.classroom)
      .map((result) => result.classroom!);
  }

  async listClassrooms(
    filters: SystemAdminClassroomListFilters = {},
  ): Promise<SystemAdminClassroomListResponse> {
    try {
      const {
        search,
        classroomStatus,
        schoolId,
        staffId,
        pos = 0,
        delta = 10,
        sortBy = "level",
        sortOrder = "ASC",
      } = filters;

      if (schoolId !== undefined) {
        const result = await classroomService.ListClassroom({
          search,
          classroomStatus,
          schoolId,
          staffId,
          pos,
          delta,
          sortBy,
          sortOrder,
        });

        if (!result.success) {
          return {
            success: false,
            message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.LIST_FAILED,
          };
        }

        return {
          success: true,
          message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.LIST_SUCCESS,
          data: {
            classrooms: result.classrooms ?? [],
            pagination: result.pagination ?? { pos, delta, count: 0 },
          },
        };
      }

      const queryBuilder = this.classroomRepository
        .createQueryBuilder("classroom")
        .where("1 = 1");

      if (classroomStatus) {
        queryBuilder.andWhere("classroom.classroomStatus = :classroomStatus", { classroomStatus });
      }

      if (search) {
        queryBuilder.andWhere("LOWER(classroom.classroomName) LIKE LOWER(:search)", {
          search: `%${search}%`,
        });
      }

      if (staffId) {
        queryBuilder.andWhere(
          'EXISTS (SELECT 1 FROM "staffClassesAndSubject" scs WHERE scs."classroomId" = classroom.id AND scs."staffId" = :staffId)',
          { staffId },
        );
      }

      const sortFieldMap: { [key: string]: string } = {
        classroomname: "classroom.classroomName",
        classroomName: "classroom.classroomName",
        level: "classroom.minimumAge",
        minimumage: "classroom.minimumAge",
        minimumAge: "classroom.minimumAge",
        maximumage: "classroom.maximumAge",
        maximumAge: "classroom.maximumAge",
        maximumcapacity: "classroom.maximumCapacity",
        maximumCapacity: "classroom.maximumCapacity",
        tuitionfee: "classroom.tuitionFee",
        tuitionFee: "classroom.tuitionFee",
        createdat: "classroom.createdAt",
        createdAt: "classroom.createdAt",
      };

      const sortField = sortFieldMap[sortBy] || "classroom.createdAt";
      queryBuilder.orderBy(sortField, sortOrder);

      queryBuilder.skip(pos).take(delta);

      const [classrooms, count] = await queryBuilder.getManyAndCount();
      const formattedClassrooms = await this.resolveFormattedClassrooms(classrooms);

      return {
        success: true,
        message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.LIST_SUCCESS,
        data: {
          classrooms: formattedClassrooms,
          pagination: {
            pos,
            delta,
            count,
          },
        },
      };
    } catch (error) {
      logger.error("System admin list classrooms error:", error);
      return {
        success: false,
        message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.LIST_FAILED,
      };
    }
  }

  async getClassroomById(classroomId: number): Promise<SystemAdminClassroomDetailResponse> {
    try {
      const result = await classroomService.getClassroomById(classroomId);

      if (!result.success || !result.classroom) {
        return {
          success: false,
          message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.CLASSROOM_NOT_FOUND,
        };
      }

      return {
        success: true,
        message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.DETAIL_SUCCESS,
        data: result.classroom,
      };
    } catch (error) {
      logger.error("System admin get classroom by id error:", error);
      return {
        success: false,
        message: SYSTEM_ADMIN_CLASSROOM_MESSAGES.DETAIL_FAILED,
      };
    }
  }
}

export const systemAdminClassroomService = new SystemAdminClassroomService();
