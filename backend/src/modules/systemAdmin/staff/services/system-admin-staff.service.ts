import { Repository } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { Staff } from "../../../shared/entities/Staff";
import { StaffClassesAndSubject } from "../../../shared/entities/StaffClassesAndSubject";
import { logger } from "../../../shared/utils/logger";
import { staffService } from "../../../staff/services/staff.service";
import { SYSTEM_ADMIN_STAFF_MESSAGES } from "../constants/messages";
import {
  SystemAdminStaffListResponse,
  SystemAdminStaffSearchFilters,
} from "../types/system-admin-staff.types";

export class SystemAdminStaffService {
  private get staffRepository(): Repository<Staff> {
    return AppDataSource.getRepository(Staff);
  }

  async listStaff(filters: SystemAdminStaffSearchFilters = {}): Promise<SystemAdminStaffListResponse> {
    try {
      const {
        search,
        role,
        schoolId,
        classroomId,
        classroom,
        qualification,
        status,
        pos = 0,
        delta = 10,
        sortBy = "lastName",
        sortOrder = "ASC",
      } = filters;

      const queryBuilder = this.staffRepository
        .createQueryBuilder("teacher")
        .leftJoinAndSelect("teacher.user", "teacherUser")
        .leftJoinAndSelect("teacherUser.profile", "profile")
        .leftJoinAndSelect("teacher.school", "school")
        .leftJoinAndSelect("teacher.emergencyContacts", "emergencyContacts")
        .leftJoinAndSelect("teacher.staffClassesAndSubject", "staffClassesAndSubject")
        .leftJoinAndSelect("staffClassesAndSubject.classroom", "classroom")
        .leftJoinAndSelect("staffClassesAndSubject.subject", "subject")
        .leftJoinAndSelect("classroom.curriculums", "curriculums")
        .leftJoinAndSelect("teacher.currentAttendance", "currentAttendance")
        .leftJoinAndSelect("teacher.previousAttendance", "previousAttendance")
        .select([
          "teacher",
          "staffClassesAndSubject",
          "classroom",
          "subject",
          "curriculums",
          "currentAttendance",
          "previousAttendance",
          "emergencyContacts",
          "profile",
          "profile.address",
          "profile.suffix",
          "profile.photo",
          "teacherUser.id",
          "teacherUser.firstName",
          "teacherUser.lastName",
          "teacherUser.middleName",
          "teacherUser.dateOfBirth",
          "teacherUser.email",
          "teacherUser.phone",
          "teacherUser.address",
          "teacherUser.role",
          "school",
          "emergencyContacts.id",
          "emergencyContacts.contactName",
          "emergencyContacts.relationship",
          "emergencyContacts.phone",
          "emergencyContacts.email",
          "emergencyContacts.address",
        ]);

      if (search) {
        queryBuilder.andWhere(
          "(LOWER(teacherUser.lastName) LIKE LOWER(:search) OR LOWER(teacherUser.firstName) LIKE LOWER(:search) OR LOWER(subject.name) LIKE LOWER(:search))",
          { search: `%${search}%` },
        );
      }

      if (schoolId) {
        queryBuilder.andWhere("teacher.schoolId = :schoolId", { schoolId });
      }

      if (classroomId) {
        queryBuilder.andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select("1")
            .from(StaffClassesAndSubject, "scs")
            .where("scs.staffId = teacher.id")
            .andWhere("scs.classroomId = :classroomId")
            .getQuery();
          return `EXISTS ${subQuery}`;
        }, { classroomId });
      }

      if (role) {
        queryBuilder.andWhere("teacher.staffRole = :role", { role });
      }

      if (status) {
        queryBuilder.andWhere("teacher.status = :status", { status });
      }

      if (classroom) {
        queryBuilder.andWhere("LOWER(classroom.classroomName) LIKE LOWER(:classroomName)", {
          classroomName: `%${classroom}%`,
        });
      }

      if (qualification) {
        queryBuilder.andWhere("LOWER(teacher.subject) LIKE LOWER(:qualification)", {
          qualification: `%${qualification}%`,
        });
      }

      const sortFieldMap: Record<string, string> = {
        id: "teacher.id",
        firstname: "teacherUser.firstName",
        firstName: "teacherUser.firstName",
        lastname: "teacherUser.lastName",
        lastName: "teacherUser.lastName",
        name: "teacherUser.lastName",
        email: "teacherUser.email",
        createdat: "teacher.createdAt",
        createdAt: "teacher.createdAt",
        updatedat: "teacher.updatedAt",
        updatedAt: "teacher.updatedAt",
      };

      const sortField = sortFieldMap[sortBy] || "teacherUser.lastName";
      queryBuilder.orderBy(sortField, sortOrder);

      if (sortField.includes("teacherUser.lastName")) {
        queryBuilder.addOrderBy("teacherUser.firstName", sortOrder);
      } else if (sortField.includes("teacherUser.firstName")) {
        queryBuilder.addOrderBy("teacherUser.lastName", sortOrder);
      }

      queryBuilder.skip(pos).take(delta);

      const [staffRecords, count] = await queryBuilder.getManyAndCount();

      return {
        success: true,
        message: "Staff retrieved successfully",
        staff: staffRecords.map((staff) => this.formatListItem(staff)),
        pagination: { pos, delta, count },
      };
    } catch (error) {
      logger.error("Error listing staff for system admin:", error);
      return { success: false, message: SYSTEM_ADMIN_STAFF_MESSAGES.LIST_FAILED };
    }
  }

  async getStaffById(staffId: number) {
    return staffService.getStaffById(staffId);
  }

  private formatListItem(staff: Staff) {
    const classroomIds = new Set<number>();
    const subjectIds = new Set<number>();
    if (staff.staffClassesAndSubject) {
      staff.staffClassesAndSubject.forEach((scs) => {
        if (scs.classroomId) {
          classroomIds.add(scs.classroomId);
        }
        const rawSubjectId = scs.subjectId ?? scs.subject?.id;
        const subjectId = Number(rawSubjectId);
        if (Number.isFinite(subjectId)) {
          subjectIds.add(subjectId);
        }
      });
    }

    return {
      id: staff.id,
      staffRole: staff.staffRole,
      qualification: staff.qualification,
      status: staff.status,
      user: {
        id: staff.user?.id,
        firstName: staff.user?.firstName,
        lastName: staff.user?.lastName,
        email: staff.user?.email,
        phone: staff.user?.phone,
        address: staff.user?.address,
        profile: staff.user?.profile
          ? {
              id: staff.user.profile.id,
              suffix: staff.user.profile.suffix,
              photo: staff.user.profile.photo,
              address: staff.user.profile.address,
            }
          : null,
      },
      assignedClasses: Array.from(classroomIds),
      subjectCount: subjectIds.size,
      attendance: {
        currentStatus: staff.currentAttendance ? staff.currentAttendance.status : "Clocked Out",
        currentAttendance: staff.currentAttendance
          ? {
              status: staff.currentAttendance.status,
              date: staff.currentAttendance.date,
              timeIn: staff.currentAttendance.timeIn,
              timeOut: staff.currentAttendance.timeOut,
            }
          : null,
        previousAttendance: staff.previousAttendance
          ? {
              status: staff.previousAttendance.status,
              date: staff.previousAttendance.date,
              timeIn: staff.previousAttendance.timeIn,
              timeOut: staff.previousAttendance.timeOut,
            }
          : null,
      },
    };
  }
}

export const systemAdminStaffService = new SystemAdminStaffService();
