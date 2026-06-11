import { School } from "../../../shared/entities/School";

export interface SystemAdminSchoolSearchFilters {
  search?: string;
  pos?: number;
  delta?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface SystemAdminSchoolListData {
  schools: School[];
  pagination: { pos: number; delta: number; count: number };
}

export interface SystemAdminSchoolListResult {
  success: boolean;
  message: string;
  data?: SystemAdminSchoolListData;
}

export interface SystemAdminSchoolDetailResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}
