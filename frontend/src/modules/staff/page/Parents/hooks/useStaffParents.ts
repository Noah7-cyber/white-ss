/* eslint-disable @typescript-eslint/no-explicit-any */

import { ParentDynamicEndpoints } from "@/services/parent.service";
import { classroomServices } from "@/services/classroom.service";
import { useQueryService } from "@/utils/hooks/useQueryService";
import { unwrapQueryDataBody } from "@/utils/unwrapQueryResponse";
import { useInfiniteQueryService } from "@/utils/hooks/useInfiniteQueryService";
import { useMemo, useState, useCallback, ChangeEvent } from "react";
import { ITEMS_PER_PAGE } from "@/constants";
import { useFilter } from "@/utils/hooks/useFilter";
import { useDebouncer } from "@/utils/hooks/useDebouncer";
import { useUser } from "@/utils/hooks/useUser";

const ALL_CLASSROOMS_VALUE = "";

export function useStaffParents() {
  const { staffId, staffClassesAndSubject } = useUser();

  const [classRoomAnchorEl, setClassRoomAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedClassRoomFilter, setSelectedClassRoomFilter] = useState<string>(ALL_CLASSROOMS_VALUE);
  const { debouncedSearch, setSearch } = useDebouncer();

  const { filters, applyFilters } = useFilter({
    search: "",
    delta: ITEMS_PER_PAGE,
    pos: 0,
  });

  // All classroom IDs this staff member is assigned to
  const staffClassroomIds = useMemo(
    () => staffClassesAndSubject.map((s) => s.classroomId),
    [staffClassesAndSubject],
  );

  // Fetch only the classrooms this staff is assigned to (for the filter dropdown)
  const {
    data: classRoomData,
    hasNextPage: hasMoreClassRoom,
    fetchNextPage: fetchNextClassPage,
  } = useInfiniteQueryService<any, any>({
    service: {
      ...classroomServices.getAllClassrooms,
      data: staffId != null ? { staffId } : {},
    },
    options: { enabled: staffId != null },
  });

  const handleSearch = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSearch(e.target.value);
  };

  const classRoomOptions = useMemo(() => {
    const list =
      classRoomData?.pages?.reduce<any[]>((acc, page) => {
        return acc.concat(page?.classrooms ?? page?.data ?? []);
      }, []) ?? [];
    const options = [{ label: "All My Classrooms", value: ALL_CLASSROOMS_VALUE }];
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
    classRoomOptions.find((o) => o.value === selectedClassRoomFilter)?.label ?? "All My Classrooms";

  const setClassroomFilter = useCallback(
    (value: string) => {
      setSelectedClassRoomFilter(value);
      applyFilters({ ...filters, pos: 0 });
    },
    [filters, applyFilters],
  );

  // If staff has selected a specific classroom use that; otherwise send all their classroomIds
  const classroomIdParam = useMemo(() => {
    if (selectedClassRoomFilter && selectedClassRoomFilter !== ALL_CLASSROOMS_VALUE) {
      return Number(selectedClassRoomFilter);
    }
    return staffClassroomIds.length > 0 ? staffClassroomIds : undefined;
  }, [selectedClassRoomFilter, staffClassroomIds]);

  const parentsQuery = useQueryService({
    service: {
      ...ParentDynamicEndpoints.getParents(
        Array.isArray(classroomIdParam) ? undefined : classroomIdParam,
      ),
      data: {
        ...(classroomIdParam != null ? { classroomId: classroomIdParam } : {}),
        pos: filters?.pos ?? 0,
        sortBy: "lastName",
        sortOrder: "DESC",
        delta: filters?.delta ?? ITEMS_PER_PAGE,
        search: debouncedSearch,
      },
    },
    options: {
      keys: [
        "staff-parents",
        staffId,
        selectedClassRoomFilter,
        filters?.pos,
        filters?.delta,
        debouncedSearch,
      ],
      enabled: staffClassroomIds.length > 0,
    },
  });

  const { isLoading } = parentsQuery;
  const parentData = unwrapQueryDataBody<Record<string, any>>(parentsQuery.data);

  const pagination = parentData?.pagination;
  const parentsList = parentData?.parents ?? [];

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
    setClassRoomAnchorEl,
    selectedClassRoomFilter,
    setSelectedClassRoomFilter: setClassroomFilter,
    selectedClassRoomLabel,
    classRoomOptions,
    fetchMoreClassRoom,
    hasMoreClassRoom,
    isLoading,
    parentsList,
    pagination,
    totalItems,
    currentPage,
    rowsPerPage: filters?.delta ?? ITEMS_PER_PAGE,
    handlePageChange,
    handleSearch,
  };
}
