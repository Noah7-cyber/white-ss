/* eslint-disable @typescript-eslint/no-explicit-any */

import { systemAdminParentEndpoints as ParentDynamicEndpoints, downloadSystemAdminParentsExport as downloadParentsExport } from "@/services/system-admin-parent.service";
import { systemAdminClassroomServices as classroomServices } from "@/services/system-admin-classroom.service";
import { useQueryService } from "@/utils/hooks/useQueryService";
import { unwrapQueryDataBody } from "@/utils/unwrapQueryResponse";
import { useInfiniteQueryService } from "@/utils/hooks/useInfiniteQueryService";
import { useMemo, useState, useCallback, ChangeEvent } from "react";
import { ITEMS_PER_PAGE } from "@/constants";
import { useFilter } from "@/utils/hooks/useFilter";
import { useDebouncer } from "@/utils/hooks/useDebouncer";
import { showToast } from "@/modules/shared/component/Toast";
import { usePermissionGuide } from "@/utils/hooks/usePermissionGuide";

const ALL_CLASSROOMS_VALUE = "";
const ALL_STATUS_VALUE = "all";

export function useParents() {
  const [classRoomAnchorEl, setClassRoomAnchorEl] = useState<HTMLElement | null>(null);
  const [statusAnchorEl, setStatusAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedClassRoomFilter, setSelectedClassRoomFilter] =
    useState<string>(ALL_CLASSROOMS_VALUE);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>(ALL_STATUS_VALUE);
  const { debouncedSearch, setSearch } = useDebouncer();
  const { hasPermission, ensurePermission } = usePermissionGuide({ enabled: true });

  const { filters, applyFilters } = useFilter({
    search: "",
    delta: ITEMS_PER_PAGE,
    pos: 0,
  });

  const STATUS_CONSTANT: Record<string, { chip: string }> = {
    active: {
      chip: "bg-green-100 text-green-700",
    },
    inactive: {
      chip: "bg-[#CF000B]/10 text-[#CF000B]",
    },
  };

  const getStatusConfig = (status: string) =>
    STATUS_CONSTANT[status?.toLowerCase()] ?? { chip: "bg-gray-100 text-gray-700" };

  const handleOpenClassRoomFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    setClassRoomAnchorEl(event.currentTarget);
  };
  const handleOpenStatusFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    setStatusAnchorEl(event.currentTarget);
  };

  const {
    data: classRoomData,
    hasNextPage: hasMoreClassRoom,
    fetchNextPage: fetchNextClassPage,
  } = useInfiniteQueryService<any, any>({
    service: {
      ...classroomServices.getAllClassrooms,
    },
  });

  const handleSearch = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSearch(e.target.value);
  };

  const classRoomOptions = useMemo(() => {
    const list =
      classRoomData?.pages?.reduce<any[]>((acc, page) => {
        return acc.concat(page?.classrooms ?? page?.data ?? []);
      }, []) ?? [];
    const options = [{ label: "All Classrooms", value: ALL_CLASSROOMS_VALUE }];
    list.forEach((c: any) => {
      options.push({ label: c.classroomName ?? c.name ?? String(c.id), value: String(c.id) });
    });
    return options;
  }, [classRoomData]);

  const fetchMoreClassRoom = async (): Promise<void> => {
    if (!hasMoreClassRoom) return;
    fetchNextClassPage();
  };

  const selectedClassRoomLabel =
    classRoomOptions.find((o) => o.value === selectedClassRoomFilter)?.label ?? "All Classrooms";
  const statusOptions = useMemo(
    () => [
      { label: "All Status", value: ALL_STATUS_VALUE },
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
    [],
  );
  const selectedStatusLabel =
    statusOptions.find((o) => o.value === selectedStatusFilter)?.label ?? "All Status";

  const setClassroomFilter = useCallback(
    (value: string) => {
      setSelectedClassRoomFilter(value);
      applyFilters({ ...filters, pos: 0 });
    },
    [filters, applyFilters],
  );
  const setStatusFilter = useCallback(
    (value: string) => {
      setSelectedStatusFilter(value);
      applyFilters({ ...filters, pos: 0 });
    },
    [filters, applyFilters],
  );

  const classroomIdParam =
    selectedClassRoomFilter && selectedClassRoomFilter !== ALL_CLASSROOMS_VALUE
      ? Number(selectedClassRoomFilter)
      : undefined;
  const statusParam =
    selectedStatusFilter && selectedStatusFilter !== ALL_STATUS_VALUE
      ? selectedStatusFilter
      : undefined;

  const parentsQuery = useQueryService({
    service: {
      ...ParentDynamicEndpoints.getAllParents,
      data: {
        ...(classroomIdParam != null ? { classroomId: classroomIdParam } : {}),
        ...(statusParam ? { status: statusParam } : {}),
        pos: filters?.pos ?? 0,
        sortBy: "lastName",
        sortOrder: "DESC",
        delta: filters?.delta ?? ITEMS_PER_PAGE,
        search: debouncedSearch,
      },
    },
    options: {
      keys: ["parents", selectedClassRoomFilter, selectedStatusFilter, filters?.pos, filters?.delta],
    },
  });

  const { isLoading } = parentsQuery;
  const parentData = unwrapQueryDataBody<Record<string, any>>(parentsQuery.data);

  const metadata = parentData?.metadata;
  const pagination = parentData?.pagination;
  const parentsList = parentData?.parents ?? [];


  const [isExporting, setIsExporting] = useState(false);

  // Download the parents list as CSV using the same filters as the table view.
  async function handleExport() {
    if (isExporting) return;
    if (!ensurePermission("parent", "view")) return;
    setIsExporting(true);
    try {
      const params: Record<string, string | number | undefined> = {
        sortBy: "lastName",
        sortOrder: "ASC",
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (classroomIdParam != null) params.classroomId = classroomIdParam;
      await downloadParentsExport(params);
      showToast({
        message: "Export ready",
        description: "The parents list has been downloaded.",
        severity: "success",
        duration: 3000,
      });
    } catch (error: any) {
      showToast({
        message: "Export failed",
        description: error?.response?.data?.message || error?.message || "Could not export parents list.",
        severity: "error",
        duration: 3000,
      });
    } finally {
      setIsExporting(false);
    }
  }

  const totalItems = pagination?.total ?? pagination?.count ?? parentsList?.length ?? 0;
  const currentPage =
    Math.floor((pagination?.pos ?? filters?.pos ?? 0) / (filters?.delta ?? ITEMS_PER_PAGE)) + 1;
  const handlePageChange = useCallback(
    ({ page, rowsPerPage }: { page: number; rowsPerPage: number }) => {
      applyFilters({
        ...filters,
        delta: rowsPerPage,
        pos: (page - 1) * rowsPerPage,
      });
    },
    [filters, applyFilters],
  );

  return {
    classRoomAnchorEl,
    statusAnchorEl,
    selectedClassRoomFilter,
    setSelectedClassRoomFilter: setClassroomFilter,
    selectedClassRoomLabel,
    selectedStatusFilter,
    setSelectedStatusFilter: setStatusFilter,
    selectedStatusLabel,
    statusOptions,
    classRoomOptions,
    fetchMoreClassRoom,
    hasMoreClassRoom,
    isLoading,
    parentsList,
    pagination,
    setClassRoomAnchorEl,
    handleOpenClassRoomFilter,
    setStatusAnchorEl,
    handleOpenStatusFilter,
    metadata,
    totalItems,
    currentPage,
    rowsPerPage: filters?.delta ?? ITEMS_PER_PAGE,
    handlePageChange,
    getStatusConfig,
    handleSearch,
    hasPermission,
    handleExport,
    isExporting,
  };
}
