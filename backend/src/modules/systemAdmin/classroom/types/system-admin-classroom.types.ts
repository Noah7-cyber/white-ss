import { Classroom } from "../../../shared/entities/Classroom";
import { ClassroomStatus } from "../../../shared/entities";

export interface SystemAdminClassroomListFilters {
  schoolId?: number;
  search?: string;
  classroomStatus?: ClassroomStatus;
  staffId?: number;
  pos?: number;
  delta?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface SystemAdminClassroomListData {
  classrooms: Classroom[];
  pagination: {
    pos: number;
    delta: number;
    count: number;
  };
}

export interface SystemAdminClassroomListResponse {
  success: boolean;
  message: string;
  data?: SystemAdminClassroomListData;
}

export interface SystemAdminClassroomDetailResponse {
  success: boolean;
  message: string;
  data?: Classroom;
}
