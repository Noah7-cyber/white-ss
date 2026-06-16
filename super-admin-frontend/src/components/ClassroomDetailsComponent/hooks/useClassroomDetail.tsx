/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardRoutes } from "@/routes/dashboard.routes";
import {
  classroomDynamicEndpoints,
  classroomServices,
  GetAllClassroomsResponse,
  GetClassroomByIdResponse,
} from "@/services/classroom.service";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { ApiMethods } from "@/utils/client";
import { childServices, Student, downloadChildrenExport } from "@/services/child.service";
import { useQueryService } from "@/utils/hooks/useQueryService";
import { unwrapQueryDataBody } from "@/utils/unwrapQueryResponse";
import { useUser } from "@/utils/hooks/useUser";
import { ITEMS_PER_PAGE } from "@/constants";
import { useFilter } from "@/utils/hooks/useFilter";
import { Typography } from "@mui/material";
import { useDebouncer } from "@/utils/hooks/useDebouncer";
import { showToast } from "../../Toast";
import InitialsAvatar from "../../InitialsAvatar/InitialsAvatar";

type ChildrenListPagination = {
  pos?: number;
  delta?: number;
  total?: number;
  count?: number;
};

const calculateChildAge = (dob?: string | null): string => {
  if (!dob) return "N/A";
  const birth = new Date(dob);
  const today = new Date();
  if (birth > today) return "0 months";
  let ageYears = today.getFullYear() - birth.getFullYear();
  let ageMonths = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();
  if (dayDiff < 0) ageMonths--;
  if (ageMonths < 0) {
    ageYears--;
    ageMonths += 12;
  }
  if (ageYears > 0) return `${ageYears} ${ageYears === 1 ? "year" : "years"}`;
  return `${Math.max(0, ageMonths)} ${Math.max(0, ageMonths) === 1 ? "month" : "months"}`;
};

export interface AssignedClassroom {
  id: number;
  classroomName: string;
}

export const useClassroomDetail = (
  classId: string | undefined,
  role: "admin" | "staff" = "admin",
) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [classroomData, setClassroomData] = useState<GetClassroomByIdResponse["classroom"] | null>(
    null,
  );
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | undefined>(
    classId || (role === "staff" ? "all" : undefined),
  );
  const { debouncedSearch, setSearch } = useDebouncer();

  // Staff-only: assigned classrooms and teacher (staff) ID from profile (useUser)
  const { staffClassesAndSubject, staffId } = useUser();
  // Pagination filters
  const { filters, applyFilters } = useFilter({
    delta: ITEMS_PER_PAGE,
    pos: 0,
  });

  // Skip the classrooms list query for the admin classroom view since that page renders
  // children, not classrooms. Admin stats are sourced from classroomData (single classroom).
  const isAdminSingleClassroom = role === "admin" && !!classId && classId !== "all";

  const { data: staffClassroomsResponse, isLoading: isClassroomsLoading } = useQueryService<any, any>({
    service: {
      ...classroomServices.getAllClassrooms,
      data: {
        ...(role === "staff" && staffId != null ? { staffId } : {}),
        search: debouncedSearch,
        ...(filters?.delta ? { delta: filters?.delta } : {}),
        ...(filters?.pos ? { pos: filters?.pos } : {}),
      },
    },
    options: {
      enabled: !isAdminSingleClassroom,
    },
  });

  const classrooms = staffClassroomsResponse?.classrooms || [];

  const assignedClassrooms = useMemo((): AssignedClassroom[] => {
    if (role !== "staff") return [];
    const apiClassrooms =
      staffClassroomsResponse?.data ??
      staffClassroomsResponse?.classrooms ??
      (staffClassroomsResponse as any)?.classrooms ??
      [];
    if (Array.isArray(apiClassrooms) && apiClassrooms.length > 0) {
      return apiClassrooms.map((c: any) => ({
        id: c.id,
        classroomName: c.classroomName ?? c.name ?? "Classroom",
      }));
    }
    if (!staffClassesAndSubject?.length) return [];
    return staffClassesAndSubject
      .filter((item) => item.classroom)
      .map((item) => ({
        id: item.classroom.id,
        classroomName: item.classroom.classroomName,
      }));
  }, [role, staffClassesAndSubject, staffClassroomsResponse]);

  const handleSearch = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSearch(e.target.value);
  };

  // Sync selectedClassroomId for staff: use classId from URL or "all"
  useEffect(() => {
    if (role !== "staff") return;
    if (classId) {
      setSelectedClassroomId(classId);
    } else {
      setSelectedClassroomId("all");
    }
  }, [role, classId]);


  // Use selectedClassroomId for fetching (for staff) or classId (for admin)
  const activeClassId = role === "staff" ? selectedClassroomId : classId;
  const isAllClassrooms = activeClassId === "all";
  // Admin viewing a specific classroom: show children enrolled in that classroom
  const isAdminClassroomView = role === "admin" && !!classId && !isAllClassrooms;

  // Reset pagination when classroom changes
  useEffect(() => {
    if (activeClassId) {
      applyFilters({
        delta: ITEMS_PER_PAGE,
        pos: 0,
      });
    }
  }, [activeClassId]);

  // Memoize the service to recreate it when activeClassId changes
  const classroomService = useMemo(() => {
    if (!activeClassId || isAllClassrooms) return null;
    return classroomDynamicEndpoints.getClassroomById(activeClassId);
  }, [activeClassId, isAllClassrooms]);

  const { mutateAsync: getClassroomById, isPending } = useMutationService<
    any,
    GetClassroomByIdResponse
  >({
    service: classroomService || { path: "", method: ApiMethods.GET },
    options: { disableToast: true },
  });
  const { mutateAsync: changeClassroomStatusAsync, isPending: isChangingStatus } = useMutationService({
    service:
      activeClassId != null
        ? classroomDynamicEndpoints.changeClassroomStatus(activeClassId)
        : { path: "", method: ApiMethods.PUT },
    options: { disableToast: true },
  });
  const { mutateAsync: deleteClassroomAsync, isPending: isDeletingClassroom } = useMutationService({
    service:
      activeClassId != null
        ? classroomDynamicEndpoints.deleteClassroom(activeClassId)
        : { path: "", method: ApiMethods.DELETE },
    options: { disableToast: true },
  });

  useEffect(() => {
    if (!activeClassId || !classroomService) return;

    const fetchClassroom = async () => {
      setLoading(true);
      try {
        const res = await getClassroomById({});
        if (res.classroom) {
          setClassroomData(res.classroom);
        }
      } catch (error) {
        console.error("Failed to fetch classroom:", error);
        setClassroomData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchClassroom();
  }, [activeClassId, classroomService]);

  // Children enrolled in the selected classroom (admin view only)
  const childrenInClassroomQuery = useQueryService<any, any>({
    service: {
      ...childServices.getAllChilds,
      data: {
        classroomId: classId,
        sortBy: "firstName",
        sortOrder: "ASC",
        ...(filters?.delta ? { delta: filters?.delta } : {}),
        ...(filters?.pos ? { pos: filters?.pos } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      },
    },
    options: {
      enabled: isAdminClassroomView,
      keys: [
        "classroom-children",
        classId ?? "",
        filters?.pos ?? 0,
        filters?.delta ?? ITEMS_PER_PAGE,
        debouncedSearch ?? "",
      ],
    },
  });

  const childrenBundle = useMemo(() => {
    const inner = unwrapQueryDataBody<{
      students?: any[];
      pagination?: ChildrenListPagination;
    }>(childrenInClassroomQuery.data);
    return {
      students: Array.isArray(inner?.students) ? inner.students : [],
      pagination: (inner?.pagination ?? {}) as ChildrenListPagination,
    };
  }, [childrenInClassroomQuery.data]);

  const classroomChildren = childrenBundle.students;
  const childrenPagination = childrenBundle.pagination;
  const isChildrenLoading = childrenInClassroomQuery.isLoading;

  // Compute stats
  const stats = useMemo(() => {
    let totalStudents = 0;
    let numStaff = 0;
    let maxCapacity = 0;

    if (activeClassId && !isAllClassrooms) {
      // Single classroom mode
      totalStudents = classroomData?.studentsCurrentClass?.length || 0;
      maxCapacity = Number(classroomData?.maximumCapacity ?? 0);
      numStaff = Array.isArray(classroomData?.assignedStaff) ? classroomData?.assignedStaff.length : 0;
    } else {
      // All classrooms mode - aggregate from classrooms list
      classrooms.forEach((room: any) => {
        totalStudents += room?.studentsCurrentClass?.length || 0;
        maxCapacity += Number(room?.maximumCapacity ?? 0);
        numStaff += Array.isArray(room?.assignedStaff) ? room?.assignedStaff.length : 0;
      });
    }

    let staffChildRatio = "N/A";
    if (numStaff > 0) {
      const getGcd = (a: number, b: number): number => (b === 0 ? a : getGcd(b, a % b));
      const gcd = getGcd(numStaff, totalStudents);
      staffChildRatio = `${numStaff / gcd}:${totalStudents / gcd}`;
    }
    const enrollment = maxCapacity > 0 ? `${totalStudents}/${maxCapacity}` : "N/A";

    return { staffChildRatio, enrollment, numStaff, totalStudents };
  }, [classroomData, classrooms, activeClassId, isAllClassrooms]);

  const handleDeactivate = async () => {
    if (!activeClassId) return;
    try {
      await changeClassroomStatusAsync({ status: classroomData?.classroomStatus === "active" ? "inactive" : "active", classroomStatus: classroomData?.classroomStatus === "active" ? "inactive" : "active" });
      showToast({
        message: classroomData?.classroomStatus === "active" ? "Classroom activated" : "Classroom deactivated",
        description: classroomData?.classroomStatus === "active" ? "The classroom has been successfully activated." : "The classroom has been successfully deactivated.",
        severity: "success",
        duration: 3000,
      });
      setDeactivateModalOpen(false);
      router.push(DashboardRoutes.classRooms);
    } catch (error: any) {
      showToast({
        message: "Unable to deactivate classroom",
        description: error?.response?.data?.message || "Please try again.",
        severity: "error",
        duration: 3000,
      });
    }
  };

  const handleDelete = async () => {
    if (!activeClassId) return;
    try {
      await deleteClassroomAsync({});
      showToast({
        message: "Classroom deleted",
        description: "The classroom has been successfully deleted.",
        severity: "success",
        duration: 3000,
      });
      setDeleteModalOpen(false);
      router.push(DashboardRoutes.classRooms);
    } catch (error: any) {
      showToast({
        message: "Unable to delete classroom",
        description: error?.response?.data?.message || "Please try again.",
        severity: "error",
        duration: 3000,
      });
    }
  };

  // Pagination calculations
  const classroomPagination = staffClassroomsResponse?.pagination || {};
  // For admin classroom view, pagination is driven by the children list
  const activePagination = isAdminClassroomView ? childrenPagination : classroomPagination;
  const fallbackTotal = isAdminClassroomView ? classroomChildren.length : classrooms.length;
  const totalItems = activePagination?.count ?? activePagination?.total ?? fallbackTotal;
  const posVal = Number(filters?.pos ?? activePagination?.pos ?? 0) || 0;
  const deltaVal =
    Number(filters?.delta ?? activePagination?.delta ?? ITEMS_PER_PAGE) || ITEMS_PER_PAGE;
  const currentPage = Math.floor(posVal / deltaVal) + 1;
  const totalPages = Math.ceil(totalItems / deltaVal) || 1;

  // Handle page change
  const handlePageChange = ({ page, rowsPerPage }: { page: number; rowsPerPage: number }) => {
    applyFilters({
      ...filters,
      delta: rowsPerPage,
      pos: (page - 1) * rowsPerPage,
    });
  };

  const [isExportingChildren, setIsExportingChildren] = useState(false);

  // Export the children currently enrolled in this classroom as a CSV.
  // Only relevant when an admin is viewing a single classroom.
  const handleExportChildren = async () => {
    if (isExportingChildren) return;
    if (!isAdminClassroomView || !classId) return;
    setIsExportingChildren(true);
    try {
      const params: Record<string, string | number | undefined> = {
        classroomId: classId,
        sortBy: "firstName",
        sortOrder: "ASC",
      };
      if (debouncedSearch) params.search = debouncedSearch;
      await downloadChildrenExport(params);
      showToast({
        message: "Export ready",
        description: "The classroom children list has been downloaded.",
        severity: "success",
        duration: 3000,
      });
    } catch (error: any) {
      showToast({
        message: "Export failed",
        description:
          error?.response?.data?.message || error?.message || "Could not export children list.",
        severity: "error",
        duration: 3000,
      });
    } finally {
      setIsExportingChildren(false);
    }
  };

  return {
    classroomData,
    classrooms,
    classroomChildren,
    isAdminClassroomView,
    loading,
    deactivateModalOpen,
    setDeactivateModalOpen,
    deleteModalOpen,
    setDeleteModalOpen,
    handleDeactivate,
    handleDelete,
    stats,
    isLoading:
      isPending ||
      isClassroomsLoading ||
      isChangingStatus ||
      isDeletingClassroom ||
      isChildrenLoading,
    assignedClassrooms,
    selectedClassroomId,
    setSelectedClassroomId,
    // Pagination
    currentPage,
    totalItems,
    totalPages,
    rowsPerPage: deltaVal,
    handlePageChange,
    handleSearch,
    calculateChildAge,
    handleExportChildren,
    isExportingChildren,
  };
};
