import { Parent } from "../../../shared/entities/Parent";
import { ParentStatus, RelationshipType } from "../../../shared/entities/EntityEnums";

export interface SystemAdminParentSearchFilters {
  schoolId?: number;
  status?: ParentStatus;
  relationship?: RelationshipType;
  pos?: number;
  delta?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface SystemAdminParentListResponse {
  success: boolean;
  message: string;
  parents?: Array<Parent & { childrenCount: number }>;
  pagination?: { pos: number; delta: number; count: number };
  metadata?: {
    totalParents: number;
    multiChildParents: number;
    activeParents: number;
  };
}

export interface SystemAdminParentDetailResponse {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}
