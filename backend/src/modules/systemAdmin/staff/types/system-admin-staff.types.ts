import { StaffStatus } from "../../../shared/entities/EntityEnums";
import { StaffResponse } from "../../../staff/services/staff.service";

export interface SystemAdminStaffSearchFilters {
  search?: string;
  role?: string;
  schoolId?: number;
  classroomId?: number;
  classroom?: string;
  qualification?: string;
  status?: StaffStatus;
  pos?: number;
  delta?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export type SystemAdminStaffListResponse = StaffResponse;
