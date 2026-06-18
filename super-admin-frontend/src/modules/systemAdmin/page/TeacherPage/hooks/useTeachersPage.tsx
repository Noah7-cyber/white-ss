/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";
import TeacherRowActions from "@/modules/admin/component/TeacherRowActions/teacherRowActions";
import { DashboardRoutes } from "@/routes/dashboard.routes";

import { systemAdminTeacherServices as teacherServices } from "@/services/system-admin-teacher.service";
import { ITEMS_PER_PAGE } from "@/constants";
import Box from "@mui/material/Box";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { useQueryService } from "@/utils/hooks/useQueryService";
import { useFilter } from "@/utils/hooks/useFilter";
import { systemAdminClassroomServices as classroomServices } from "@/services/system-admin-classroom.service";
import { useDebouncer } from "@/utils/hooks/useDebouncer";
import InitialsAvatar from "@/modules/shared/component/InitialsAvatar/InitialsAvatar";
import { usePermissionGuide } from "@/utils/hooks/usePermissionGuide";

const useTeachersPage = () => {
  const [selectedFilter, setSelectedFilter] = useState<string>("Filter");
  const { filters, applyFilters } = useFilter({
    search: "",
    delta: ITEMS_PER_PAGE,
    pos: 0,
    schoolId: undefined,
  });
  const [gradeAnchorEl, setGradeAnchorEl] = useState<HTMLElement | null>(null);
  const handleOpenGradeFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    setGradeAnchorEl(event.currentTarget);
  };
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedClassroomFilter, setSelectedClassroomFilter] = useState("all");
  const { debouncedSearch, setSearch } = useDebouncer();
  const { hasPermission, ensurePermission } = usePermissionGuide({ enabled: true });

  const { mutateAsync: getAllClassrooms } = useMutationService({
    service: classroomServices.getAllClassrooms,
    options: {
      disableToast: true,
    },
  });

  const {
    data: { staff: allTeacherList = [], pagination = {} } = {} as any,
    isLoading,
    refetch,
  } = useQueryService<any, any>({
    service: {
      ...teacherServices.getAllTeachers,
      data: {
        ...(filters?.search ? { search: filters?.search } : {}),
        ...(filters?.delta ? { delta: filters?.delta } : {}),
        ...(filters?.pos ? { pos: filters?.pos } : {}),
        ...(filters?.schoolId ? { schoolId: filters?.schoolId } : {}),
        ...(selectedClassroomFilter !== "all" ? { classroomId: selectedClassroomFilter } : {}),
        search: debouncedSearch,
        sortBy: "firstName",
      },
    },
  });

  const STATUS_CONSTANT: Record<string, { chip: string }> = {
    active: {
      chip: "bg-green-100 text-green-700",
    },
    inactive: {
      chip: "bg-[#CF000B]/10 text-[#CF000B]",
    },
    suspended: {
      chip: "bg-[#FFF6DD] text-[#A88400]",
    },
  };

  const getStatusConfig = (status: string) =>
    STATUS_CONSTANT[status?.toLowerCase()] ?? { chip: "bg-gray-100 text-gray-700" };


  /** ---- METRICS SOURCE: FETCH ALL TEACHERS (no pagination, for cards) ---- */
  const { mutateAsync: getAllTeachers } = useMutationService({
    service: teacherServices.getAllTeachers,
    options: {
      disableToast: true,
    },
  });

  const [allTeachers, setAllTeachers] = useState<any[]>([]);

  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        const res = (await getAllClassrooms({
          delta: 100,
          pos: 0,
          sortBy: "createdAt",
          sortOrder: "ASC",
        })) as any;
        const classroomList = res?.data?.classrooms || res?.classrooms || [];
        setClassrooms(Array.isArray(classroomList) ? classroomList : []);
      } catch {
        setClassrooms([]);
      }
    };
    fetchClassrooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build a map of classroomId -> classroomName
  const classroomMap = useMemo(() => {
    const map = new Map<number, string>();
    (Array.isArray(classrooms) ? classrooms : []).forEach((c: any) => {
      if (c?.id != null && c.classroomName) {
        map.set(c.id, c.classroomName);
      }
    });
    return map;
  }, [classrooms]);

  const classroomFilters = useMemo(
    () => [
      { label: "All Classrooms", value: "all", isActive: selectedClassroomFilter === "all" },
      ...classrooms.map((c: any) => ({
        label: c.classroomName || c.name,
        value: String(c.id),
        isActive: selectedClassroomFilter === String(c.id),
      })),
    ],
    [classrooms, selectedClassroomFilter],
  );

  const handleClassroomFilterChange = (value: string) => {
    setSelectedClassroomFilter(value);
    applyFilters({ ...filters, pos: 0 });
  };

  const fetchAllTeachersMetrics = useCallback(async () => {
    try {
      const DELTA = 100;
      let allTeachersList: any[] = [];
      let pos = 0;
      let totalCount = 0;
      const firstPageRes: any = await getAllTeachers({ delta: DELTA, pos: 0 });
      const firstPageList = firstPageRes?.staff || firstPageRes?.data || [];
      const paginationInfo = firstPageRes?.pagination || {};
      totalCount = paginationInfo?.count || firstPageList.length;
      if (Array.isArray(firstPageList)) allTeachersList = [...firstPageList];
      if (totalCount > DELTA) {
        const totalPages = Math.ceil(totalCount / DELTA);
        const remainingPagePromises = [];
        for (let page = 2; page <= totalPages; page++) {
          pos = (page - 1) * DELTA;
          remainingPagePromises.push(getAllTeachers({ delta: DELTA, pos }));
        }
        const remainingPages = await Promise.all(remainingPagePromises);
        remainingPages.forEach((res: any) => {
          const list = res?.staff || res?.data || [];
          if (Array.isArray(list)) allTeachersList = [...allTeachersList, ...list];
        });
      }
      setAllTeachers(allTeachersList);
    } catch {
      setAllTeachers([]);
    }
  }, [getAllTeachers]);

  useEffect(() => {
    fetchAllTeachersMetrics();
  }, [fetchAllTeachersMetrics]);


  const renderRowActions = (teacherId: number, teacherStatus?: string) => (
    <TeacherRowActions
      onView={() => {
        router.push(`${DashboardRoutes.teachers}/${teacherId}`);
      }}
      onEdit={undefined}
      onDeactivate={undefined}
      onDelete={undefined}
      onResendInvite={undefined}
      showResendInvite={false}
      deactivateActionLabel={
        String(teacherStatus || "").toLowerCase() === "active" ? "Deactivate" : "Activate"
      }
    />
  );


  const StatusCell = ({ status }: { status: string }) => {
    const { chip } = getStatusConfig(status);

    return (
      <Box
        className={`flex items-center justify-center gap-2 px-2 py-1 rounded-full min-w-[80px] w-1/2 ${chip}`}
      >
        <span className="text-xs! font-normal! capitalize ">{status}</span>
      </Box>
    );
  };

  const TeacherList = allTeacherList?.map((owner: any) => {
    // Map assignedClasses (array of IDs or objects) to classroom names
    let classroomNames = "N/A";
    if (owner?.assignedClasses && owner.assignedClasses.length > 0) {
      // If assignedClasses is array of IDs
      if (typeof owner.assignedClasses[0] === "number") {
        classroomNames = owner.assignedClasses
          .map((id: number) => classroomMap.get(id) || id)
          .join(", ");
      } else {
        // If assignedClasses is array of objects with id
        classroomNames = owner.assignedClasses
          .map(
            (c: any) =>
              classroomMap.get(c.classroomId || c.id) || c.classroomName || c.name || c.id,
          )
          .join(", ");
      }
    }

    return {
      0: (
        <Box className="flex items-center gap-2">
          <InitialsAvatar
            src={owner?.user?.profile?.photo || ""}
            name={`${owner?.user?.firstName || ""} ${owner?.user?.lastName || ""}`.trim()}
            className="w-10 h-10"
            initialsClassName="text-[10px]"
          />
          <span>
            {owner?.user?.firstName} {owner?.user?.lastName}
          </span>
        </Box>
      ),
      1: <Box className="truncate max-w-[150px] !text-start">{"None"}</Box>,
      2: (
        <Box
          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          className="truncate max-w-[150px] !text-start"
        >
          {classroomNames}
        </Box>
      ),
      3: (
        <Box className="flex justify-start items-center">
          <Box className="truncate max-w-[150px] text-start">{owner?.user?.profile?.address}</Box>
        </Box>
      ),
      4: (
        <Box className="flex justify-center items-center">
          <StatusCell status={owner?.status || "N/A"} />
        </Box>
      ),

      5: renderRowActions(owner?.id, owner?.status),
    };
  });

  const mobileTeachersData = allTeacherList?.map((owner: any) => {
    let classroomNames = "N/A";
    if (owner?.assignedClasses && owner.assignedClasses.length > 0) {
      if (typeof owner.assignedClasses[0] === "number") {
        classroomNames = owner.assignedClasses
          .map((id: number) => classroomMap.get(id) || id)
          .join(", ");
      } else {
        classroomNames = owner.assignedClasses
          .map(
            (c: any) =>
              classroomMap.get(c.classroomId || c.id) || c.classroomName || c.name || c.id,
          )
          .join(", ");
      }
    }

    return {
      id: owner?.id,
      name: `${owner?.user?.firstName || ""} ${owner?.user?.lastName || ""}`.trim() || "N/A",
      classes: classroomNames,
    };
  });

  const currentPage =
    Math.floor((pagination?.pos || 0) / (pagination?.delta || ITEMS_PER_PAGE)) + 1;

  /** ---- METRICS FOR INSIGHT CARDS ---- */
  const metricsSource = (allTeachers.length ? allTeachers : allTeacherList) as any[];

  const totalStaffCount = metricsSource.length;
  const leadTeachersCount = metricsSource.filter(
    (t: any) => t?.role === "lead_teacher" || t?.staffRole === "lead_teacher",
  ).length;
  const assistantTeachersCount = metricsSource.filter(
    (t: any) => t?.role === "assistant_teacher" || t?.staffRole === "assistant_teacher",
  ).length;

  const handleSearch = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSearch(e.target.value);
  };

  return {
    router,
    selectedFilter,
    setSelectedFilter,
    gradeAnchorEl,
    setGradeAnchorEl,
    handleOpenGradeFilter,
    selectedClassroomFilter,
    handleClassroomFilterChange,
    classroomFilters,
    currentPage,
    filters,
    applyFilters,
    isLoading,
    totalStaff: pagination?.count || 0,
    totalStaffCount,
    leadTeachersCount,
    assistantTeachersCount,
    pagination,
    TeacherList,
    mobileTeachersData,
    teacherIds: (allTeacherList || []).map((t: any) => t?.id),
    handleSearch,
  };
};

export default useTeachersPage;
