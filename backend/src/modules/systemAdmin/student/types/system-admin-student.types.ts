import { User } from "../../../shared/entities/User";
import { StudentStatus } from "../../../shared/entities/EntityEnums";

export interface SystemAdminStudentSearchFilters {
  schoolId?: number;
  status?: StudentStatus;
  classroomId?: number;
  pos?: number;
  delta?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface SystemAdminStudentListItem {
  id: number;
  userId: number;
  admissionNumber?: string;
  enrolmentDate?: Date;
  schedule?: string[];
  photoUrl?: string;
  schoolId: number;
  classroomId?: number;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  user: User;
}

export interface SystemAdminStudentListData {
  students: SystemAdminStudentListItem[];
  pagination: { pos: number; delta: number; count: number };
}

export interface SystemAdminStudentListResult {
  success: boolean;
  message: string;
  data?: SystemAdminStudentListData;
}

export interface SystemAdminStudentDetailResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}
