import { Response } from "express";
import { AuthenticatedRequest } from "../../../auth/middleware/middleware";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { StudentStatus } from "../../../shared/entities/EntityEnums";
import { systemAdminStudentService } from "../services/system-admin-student.service";
import { SYSTEM_ADMIN_STUDENT_MESSAGES } from "../constants/messages";
import { SystemAdminStudentSearchFilters } from "../types/system-admin-student.types";

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
}

export const systemAdminStudentController = new SystemAdminStudentController();
