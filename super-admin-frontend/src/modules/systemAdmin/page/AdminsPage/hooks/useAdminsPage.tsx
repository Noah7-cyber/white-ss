"use client";

import { useQueryService } from "@/utils/hooks/useQueryService";
import { systemAdminAdminServices as adminServices } from "@/services/system-admin-admin.service";
import { useFilter } from "@/utils/hooks/useFilter";
import { ITEMS_PER_PAGE } from "@/constants";
import { useDebouncer } from "@/utils/hooks/useDebouncer";

export default function useAdminsPage() {
  const { filters, applyFilters } = useFilter({
    search: "",
    delta: ITEMS_PER_PAGE,
    pos: 0,
    schoolId: undefined,
  });
  const { debouncedSearch, setSearch } = useDebouncer();

  const { data, isLoading } = useQueryService<unknown, { data?: { admins: unknown[]; pagination: { pos: number; delta: number; count: number } } }>({
    service: {
      ...adminServices.getAllAdmins,
      data: {
        ...(filters?.search ? { search: filters?.search } : {}),
        ...(filters?.delta ? { delta: filters?.delta } : {}),
        ...(filters?.pos ? { pos: filters?.pos } : {}),
        ...(filters?.schoolId ? { schoolId: filters?.schoolId } : {}),
        search: debouncedSearch,
      },
    },
  });

  const adminsList = data?.data?.admins || [];
  const pagination = data?.data?.pagination || { pos: 0, delta: ITEMS_PER_PAGE, count: 0 };
  const adminIds = adminsList.map((a: { id?: number }) => a.id);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    applyFilters({ search: e.target.value, pos: 0 });
  };

  return {
    adminsList,
    adminIds,
    pagination,
    isLoading,
    filters,
    applyFilters,
    handleSearch,
  };
}
