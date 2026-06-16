import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { StudentStatus } from "../../../shared/entities/EntityEnums";
import { systemAdminStudentService } from "../services/system-admin-student.service";
import { SYSTEM_ADMIN_STUDENT_MESSAGES } from "../constants/messages";
import { SystemAdminStudentSearchFilters } from "../types/system-admin-student.types";
import { buildXlsxBuffer, sanitizeXlsxFilename, sendXlsx } from "../../../shared/utils/xlsx";

export class SystemAdminStudentController {
  async listStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { schoolId, status, classroomId, pos, delta, sortBy, sortOrder } = req.query;

      const filters: SystemAdminStudentSearchFilters = {
        pos: pos ? parseInt(pos as string, 10) : 0,
        delta: delta ? parseInt(delta as string, 10) : 10,
      };

      if (schoolId) {
        filters.schoolId = parseInt(schoolId as string, 10);
      }
      if (status) {
        filters.status = status as StudentStatus;
      }
      if (classroomId) {
        filters.classroomId = parseInt(classroomId as string, 10);
      }
      if (sortBy) {
        filters.sortBy = sortBy as string;
      }
      if (sortOrder) {
        filters.sortOrder = sortOrder as "ASC" | "DESC";
      }

      const result = await systemAdminStudentService.listStudents(filters);

      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      console.error("System admin list students error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }

  async getStudentById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params["id"];
      const studentId = parseInt(idParam ?? "", 10);

      if (!idParam || Number.isNaN(studentId)) {
        res.status(400).json({ success: false, message: SYSTEM_ADMIN_STUDENT_MESSAGES.INVALID_STUDENT_ID });
        return;
      }

      const result = await systemAdminStudentService.getStudentById(studentId);

      if (!result.success) {
        const statusCode = result.message === SYSTEM_ADMIN_STUDENT_MESSAGES.STUDENT_NOT_FOUND ? 404 : 400;
        res.status(statusCode).json({ success: false, message: result.message });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      console.error("System admin get student by id error:", error);
      res.status(500).json({ success: false, message: AUTH_MESSAGES.INTERNAL_ERROR });
    }
  }

  async exportStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { schoolId, status, classroomId, sortBy, sortOrder } = req.query;

      const filters: SystemAdminStudentSearchFilters = {};
      if (schoolId) {
        filters.schoolId = parseInt(schoolId as string, 10);
      }
      if (status) {
        filters.status = status as StudentStatus;
      }
      if (classroomId) {
        filters.classroomId = parseInt(classroomId as string, 10);
      }
      if (sortBy) {
        filters.sortBy = sortBy as string;
      }
      if (sortOrder) {
        filters.sortOrder = sortOrder as "ASC" | "DESC";
      }

      const students = await systemAdminStudentService.getStudentsForExport(filters);

      const columns = [
        { header: "School", width: 28 },
        { header: "Admission Number", width: 18 },
        { header: "First Name", width: 18 },
        { header: "Last Name", width: 18 },
        { header: "Middle Name", width: 18 },
        { header: "Gender", width: 10 },
        { header: "Date of Birth", width: 14 },
        { header: "Age", width: 12 },
        { header: "Classroom", width: 22 },
        { header: "Status", width: 12 },
        { header: "Enrolment Date", width: 14 },
        { header: "Schedule", width: 28 },
        { header: "Email", width: 28 },
        { header: "Phone", width: 16 },
        { header: "Address", width: 32 },
        { header: "Parents", width: 32 },
        { header: "Parent Emails", width: 32 },
        { header: "Parent Phones", width: 22 },
        { header: "Emergency Contact Name", width: 22 },
        { header: "Emergency Contact Phone", width: 18 },
        { header: "Allergies", width: 28 },
      ];

      const computeAge = (dob: Date | string | undefined | null): string => {
        if (!dob) return "";
        const birth = new Date(dob);
        if (Number.isNaN(birth.getTime())) return "";
        const today = new Date();
        if (birth > today) return "0 months";
        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();
        if (today.getDate() < birth.getDate()) months--;
        if (months < 0) {
          years--;
          months += 12;
        }
        if (years > 0) return `${years} ${years === 1 ? "year" : "years"}`;
        return `${Math.max(0, months)} ${Math.max(0, months) === 1 ? "month" : "months"}`;
      };

      const toDate = (value: Date | string | null | undefined): Date | null => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      };

      const rows: unknown[][] = students.map((student: any) => {
        const parents: any[] = Array.isArray(student.parents) ? student.parents : [];
        const parentNames = parents
          .map((p) => `${p?.user?.firstName ?? ""} ${p?.user?.lastName ?? ""}`.trim())
          .filter(Boolean)
          .join("; ");
        const parentEmails = parents
          .map((p) => p?.user?.email)
          .filter(Boolean)
          .join("; ");
        const parentPhones = parents
          .map((p) => p?.user?.phone)
          .filter(Boolean)
          .join("; ");

        return [
          student.school?.schoolName ?? "",
          student.admissionNumber ?? "",
          student.user?.firstName ?? "",
          student.user?.lastName ?? "",
          student.user?.middleName ?? "",
          student.user?.gender ?? "",
          toDate(student.user?.dateOfBirth),
          computeAge(student.user?.dateOfBirth),
          student.currentClassroom?.classroomName ?? "",
          student.status ?? "",
          toDate(student.enrolmentDate),
          Array.isArray(student.schedule) ? student.schedule.join("; ") : "",
          student.user?.email ?? "",
          student.user?.phone ?? "",
          student.user?.address ?? "",
          parentNames,
          parentEmails,
          parentPhones,
          student.emergencyContact?.contactName ?? "",
          student.emergencyContact?.phone ?? "",
          student.medicalRecord?.allergies ?? "",
        ];
      });

      const buffer = await buildXlsxBuffer({
        sheetName: "Students",
        title: "Students export",
        columns,
        rows,
      });
      const today = new Date().toISOString().split("T")[0];
      const baseName = filters.schoolId ? `school-${filters.schoolId}-students` : "all-students";
      const filename = `${sanitizeXlsxFilename(baseName)}-${today}.xlsx`;

      sendXlsx(res, filename, buffer);
    } catch (error) {
      console.error("System admin export students error:", error);
      res.status(500).json({ success: false, message: SYSTEM_ADMIN_STUDENT_MESSAGES.LIST_FAILED });
    }
  }
}

export const systemAdminStudentController = new SystemAdminStudentController();
