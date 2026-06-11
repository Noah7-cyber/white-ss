import { AdminRole } from "../../../shared/entities/EntityEnums";

export interface SystemAdminAdminSearchFilters {
  schoolId?: number;
  search?: string;
  pos?: number;
  delta?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface SystemAdminAdminListItem {
  id: number;
  userId: number;
  schoolId: number;
  role?: AdminRole;
  user: {
    id: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    profile?: { photo?: string } | null;
  } | null;
}

export interface SystemAdminAdminListData {
  admins: SystemAdminAdminListItem[];
  pagination: { pos: number; delta: number; count: number };
}

export interface SystemAdminAdminListResult {
  success: boolean;
  message: string;
  data?: SystemAdminAdminListData;
}

export interface SystemAdminAdminDetailResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}
