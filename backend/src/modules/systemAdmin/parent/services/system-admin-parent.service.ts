import { Repository, SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { Parent } from "../../../shared/entities/Parent";
import { parentService } from "../../../parent/services/parent.service";
import { SYSTEM_ADMIN_PARENT_MESSAGES } from "../constants/messages";
import {
  SystemAdminParentDetailResponse,
  SystemAdminParentListResponse,
  SystemAdminParentSearchFilters,
} from "../types/system-admin-parent.types";

export class SystemAdminParentService {
  private parentRepository: Repository<Parent>;

  constructor() {
    this.parentRepository = AppDataSource.getRepository(Parent);
  }

  async listParents(filters: SystemAdminParentSearchFilters = {}): Promise<SystemAdminParentListResponse> {
    try {
      const pos = filters.pos ?? 0;
      const delta = filters.delta ?? 10;

      const baseQuery = this.parentRepository
        .createQueryBuilder("parent")
        .where("parent.deletedAt IS NULL");
      this.applyOptionalFilters(baseQuery, filters);

      const totalParents = await baseQuery.getCount();

      const multiChildQb = this.parentRepository
        .createQueryBuilder("parent")
        .leftJoin("parent.children", "child", "child.schoolId = parent.schoolId")
        .where("parent.deletedAt IS NULL");
      this.applyOptionalFilters(multiChildQb, filters);
      const multiChildParentsResult = await multiChildQb
        .select("parent.id")
        .groupBy("parent.id")
        .having("COUNT(child.id) > 1")
        .getRawMany();
      const multiChildParents = multiChildParentsResult.length;

      const activeParentsQb = this.parentRepository
        .createQueryBuilder("parent")
        .leftJoin("parent.user", "user")
        .where("parent.deletedAt IS NULL")
        .andWhere("user.isActive = :isActive", { isActive: true })
        .andWhere("user.deletedAt IS NULL");
      this.applyOptionalFilters(activeParentsQb, filters);
      const activeParents = await activeParentsQb.getCount();

      const queryBuilder = this.parentRepository
        .createQueryBuilder("parent")
        .leftJoinAndSelect("parent.user", "user")
        .leftJoin("parent.children", "child", "child.schoolId = parent.schoolId")
        .addSelect("COUNT(child.id)", "childrenCount")
        .where("parent.deletedAt IS NULL");
      this.applyOptionalFilters(queryBuilder, filters);

      queryBuilder.groupBy("parent.id").addGroupBy("user.id");

      const sortByInput = filters.sortBy || "lastName";
      const sortOrder = filters.sortOrder || "ASC";

      const sortFieldMap: Record<string, string> = {
        firstname: "user.firstName",
        firstName: "user.firstName",
        lastname: "user.lastName",
        lastName: "user.lastName",
        createdat: "parent.createdAt",
        createdAt: "parent.createdAt",
      };

      const sortField = sortFieldMap[sortByInput] || "user.lastName";
      queryBuilder.orderBy(sortField, sortOrder);

      if (sortField.includes("user.lastName")) {
        queryBuilder.addOrderBy("user.firstName", sortOrder);
      } else if (sortField.includes("user.firstName")) {
        queryBuilder.addOrderBy("user.lastName", sortOrder);
      }

      const rawResults = await queryBuilder.skip(pos).take(delta).getRawAndEntities();

      const parents = rawResults.entities.map((parent, index) => ({
        ...parent,
        childrenCount: parseInt(rawResults.raw[index].childrenCount, 10) || 0,
      }));

      const countQuery = this.parentRepository
        .createQueryBuilder("parent")
        .leftJoin("parent.user", "user")
        .where("parent.deletedAt IS NULL");
      this.applyOptionalFilters(countQuery, filters);
      const count = await countQuery.getCount();

      return {
        success: true,
        message: "Parents retrieved successfully",
        parents,
        pagination: { pos, delta, count },
        metadata: {
          totalParents,
          multiChildParents,
          activeParents,
        },
      };
    } catch (error) {
      console.error("System admin list parents error:", error);
      return { success: false, message: SYSTEM_ADMIN_PARENT_MESSAGES.LIST_FAILED };
    }
  }

  async getParentById(parentId: number): Promise<SystemAdminParentDetailResponse> {
    try {
      const parent = await parentService.getParentById(parentId);
      if (!parent) {
        return { success: false, message: SYSTEM_ADMIN_PARENT_MESSAGES.PARENT_NOT_FOUND };
      }
      return { success: true, data: parent };
    } catch (error) {
      console.error("System admin get parent by id error:", error);
      return { success: false, message: SYSTEM_ADMIN_PARENT_MESSAGES.DETAIL_FAILED };
    }
  }

  private applyOptionalFilters(
    qb: SelectQueryBuilder<Parent>,
    filters: SystemAdminParentSearchFilters,
  ): void {
    if (filters.schoolId) {
      qb.andWhere("parent.schoolId = :schoolId", { schoolId: filters.schoolId });
    }
    if (filters.status) {
      qb.andWhere("parent.status = :status", { status: filters.status });
    }
    if (filters.relationship) {
      qb.andWhere("parent.relationship = :relationship", { relationship: filters.relationship });
    }
  }
}

export const systemAdminParentService = new SystemAdminParentService();
