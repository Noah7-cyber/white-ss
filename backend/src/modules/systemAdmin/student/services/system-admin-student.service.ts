import { Repository, SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { Student } from "../../../shared/entities/StudentEntity";
import { StudentStatus } from "../../../shared/entities/EntityEnums";
import { studentService } from "../../../student/services/student.service";
import { SYSTEM_ADMIN_STUDENT_MESSAGES } from "../constants/messages";
import {
  SystemAdminStudentDetailResult,
  SystemAdminStudentListItem,
  SystemAdminStudentListResult,
  SystemAdminStudentSearchFilters,
} from "../types/system-admin-student.types";

const PAYSTACK_SCHOOL_FIELDS = [
  "PaystackPublicKey",
  "PaystackSecretKey",
  "PaystackSecretIv",
  "PaystackSecretTag",
] as const;

export class SystemAdminStudentService {
  private studentRepository: Repository<Student>;

  constructor() {
    this.studentRepository = AppDataSource.getRepository(Student);
  }

  async listStudents(filters: SystemAdminStudentSearchFilters = {}): Promise<SystemAdminStudentListResult> {
    try {
      const pos = filters.pos ?? 0;
      const delta = filters.delta ?? 10;

      const queryBuilder = this.studentRepository
        .createQueryBuilder("student")
        .leftJoinAndSelect("student.user", "user");

      this.applyBaseFilters(queryBuilder, filters);
      this.applyOptionalFilters(queryBuilder, filters);

      const sortBy = filters.sortBy || "lastName";
      const sortOrder = filters.sortOrder || "ASC";

      const sortFieldMap: Record<string, string> = {
        firstName: "user.firstName",
        firstname: "user.firstName",
        lastName: "user.lastName",
        lastname: "user.lastName",
        createdAt: "student.createdAt",
        createdat: "student.createdAt",
        admissionNumber: "student.admissionNumber",
        admissionnumber: "student.admissionNumber",
      };

      const sortField = sortFieldMap[sortBy] || "user.lastName";
      queryBuilder.orderBy(sortField, sortOrder);

      const [students, count] = await queryBuilder.skip(pos).take(delta).getManyAndCount();

      return {
        success: true,
        message: SYSTEM_ADMIN_STUDENT_MESSAGES.LIST_SUCCESS,
        data: {
          students: students.map((student) => this.formatListItem(student)),
          pagination: { pos, delta, count },
        },
      };
    } catch (error) {
      console.error("System admin list students error:", error);
      return { success: false, message: SYSTEM_ADMIN_STUDENT_MESSAGES.LIST_FAILED };
    }
  }

  /**
   * Cross-tenant student export. `schoolId` is optional: when provided the result
   * is scoped to that school (respecting the System Admin's active school filter);
   * when omitted every school is included.
   */
  async getStudentsForExport(
    filters: SystemAdminStudentSearchFilters = {},
    exportLimit = 10000,
  ): Promise<Student[]> {
    const queryBuilder = this.studentRepository
      .createQueryBuilder("student")
      .leftJoinAndSelect("student.user", "user")
      .leftJoinAndSelect("student.school", "school")
      .leftJoinAndSelect("student.currentClassroom", "currentClassroom")
      .leftJoinAndSelect("student.parents", "parents")
      .leftJoinAndSelect("parents.user", "parentUser")
      .leftJoinAndSelect("student.medicalRecord", "medicalRecord")
      .leftJoinAndSelect("student.emergencyContact", "emergencyContact");

    this.applyBaseFilters(queryBuilder, filters);
    this.applyOptionalFilters(queryBuilder, filters);

    const sortBy = filters.sortBy || "lastName";
    const sortOrder = filters.sortOrder || "ASC";
    const sortFieldMap: Record<string, string> = {
      firstName: "user.firstName",
      lastName: "user.lastName",
      createdAt: "student.createdAt",
      admissionNumber: "student.admissionNumber",
    };
    const sortField = sortFieldMap[sortBy] || "user.lastName";
    queryBuilder.orderBy(sortField, sortOrder);

    return queryBuilder.take(exportLimit).getMany();
  }

  async getStudentById(studentId: number): Promise<SystemAdminStudentDetailResult> {
    try {
      const student = await studentService.getStudentById(studentId);

      if (!student || typeof student !== "object" || !("id" in student) || (student as { success?: boolean }).success === false) {
        return { success: false, message: SYSTEM_ADMIN_STUDENT_MESSAGES.STUDENT_NOT_FOUND };
      }

      return {
        success: true,
        message: SYSTEM_ADMIN_STUDENT_MESSAGES.DETAIL_SUCCESS,
        data: this.stripPaystackKeysFromStudentDetail(student as Record<string, unknown>),
      };
    } catch (error) {
      console.error("System admin get student by id error:", error);
      return { success: false, message: SYSTEM_ADMIN_STUDENT_MESSAGES.DETAIL_FAILED };
    }
  }

  private stripPaystackKeysFromStudentDetail(student: Record<string, unknown>): Record<string, unknown> {
    const school = student["school"];
    if (!school || typeof school !== "object") {
      return student;
    }

    const sanitizedSchool = { ...(school as Record<string, unknown>) };
    for (const field of PAYSTACK_SCHOOL_FIELDS) {
      delete sanitizedSchool[field];
    }

    return { ...student, school: sanitizedSchool };
  }

  private formatListItem(student: Student): SystemAdminStudentListItem {
    return {
      id: student.id,
      userId: student.userId,
      admissionNumber: student.admissionNumber,
      enrolmentDate: student.enrolmentDate,
      schedule: student.schedule,
      photoUrl: student.photoUrl,
      schoolId: student.schoolId,
      classroomId: student.classroomId,
      status: student.status,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      deletedAt: student.deletedAt,
      user: student.user,
    };
  }

  private applyBaseFilters(qb: SelectQueryBuilder<Student>, filters: SystemAdminStudentSearchFilters): void {
    if (filters.status === StudentStatus.EXPEL) {
      qb.withDeleted();
    } else {
      qb.andWhere("student.deletedAt IS NULL");
    }
  }

  private applyOptionalFilters(qb: SelectQueryBuilder<Student>, filters: SystemAdminStudentSearchFilters): void {
    if (filters.schoolId) {
      qb.andWhere("student.schoolId = :schoolId", { schoolId: filters.schoolId });
    }
    if (filters.status) {
      qb.andWhere("student.status = :status", { status: filters.status });
    }
    if (filters.classroomId) {
      qb.andWhere("student.classroomId = :classroomId", { classroomId: filters.classroomId });
    }
  }
}

export const systemAdminStudentService = new SystemAdminStudentService();
