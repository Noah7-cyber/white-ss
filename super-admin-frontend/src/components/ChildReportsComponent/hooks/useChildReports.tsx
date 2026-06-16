"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ITEMS_PER_PAGE } from "@/constants";
import { useFilter } from "@/utils/hooks/useFilter";
import { useQueryService } from "@/utils/hooks/useQueryService";
import {
  downloadChildReportsExport,
  StudentReportDelivery,
  StudentReportListPagination,
  StudentReportListResponse,
  StudentReportType,
  studentReportDynamicEndpoints,
} from "@/services/studentReport.service";
import { showToast } from "@/modules/shared/component/Toast";

// Tab-local query param prefix used to scope filter URL state so it does not
// collide with any other component that listens to ?type / ?startDate etc.
const QP_TYPE = "reportType";
const QP_START = "reportStartDate";
const QP_END = "reportEndDate";
const QP_POS = "reportPos";
const QP_DELTA = "reportDelta";

export type ReportTypeFilter = "all" | StudentReportType;

export interface ChildReportsFilters {
  type: ReportTypeFilter;
  startDate: string;
  endDate: string;
  pos: number;
  delta: number;
}

const DEFAULT_FILTERS: ChildReportsFilters = {
  type: "all",
  startDate: "",
  endDate: "",
  pos: 0,
  delta: ITEMS_PER_PAGE,
};

function readInitialFilters(searchParams: URLSearchParams | null): ChildReportsFilters {
  if (!searchParams) return DEFAULT_FILTERS;

  const rawType = searchParams.get(QP_TYPE) ?? "all";
  const type: ReportTypeFilter =
    rawType === "daily_activity" ||
    rawType === "weekly_activity" ||
    rawType === "selected_activities"
      ? rawType
      : "all";

  const startDate = searchParams.get(QP_START) ?? "";
  const endDate = searchParams.get(QP_END) ?? "";
  const pos = Number(searchParams.get(QP_POS) ?? "0");
  const delta = Number(searchParams.get(QP_DELTA) ?? ITEMS_PER_PAGE);

  return {
    type,
    startDate,
    endDate,
    pos: Number.isFinite(pos) && pos >= 0 ? pos : 0,
    delta: Number.isFinite(delta) && delta > 0 ? delta : ITEMS_PER_PAGE,
  };
}

export function useChildReports(childId: string | number | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const initialFilters = useMemo(() => readInitialFilters(searchParams), [searchParams]);
  const { filters, applyFilters } = useFilter(initialFilters);

  // Persist filter state to the URL so refresh + deep-linking work.
  const updateUrlParams = useCallback(
    (next: Partial<ChildReportsFilters>) => {
      if (!router || !pathname || !searchParams) return;
      const params = new URLSearchParams(searchParams.toString());

      const writeOrDelete = (key: string, value: string | number | undefined) => {
        if (value === undefined || value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      };

      if ("type" in next) writeOrDelete(QP_TYPE, next.type);
      if ("startDate" in next) writeOrDelete(QP_START, next.startDate);
      if ("endDate" in next) writeOrDelete(QP_END, next.endDate);
      if ("pos" in next) writeOrDelete(QP_POS, next.pos);
      if ("delta" in next) writeOrDelete(QP_DELTA, next.delta);

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setFilters = useCallback(
    (next: Partial<ChildReportsFilters>) => {
      applyFilters(next);
      updateUrlParams(next);
    },
    [applyFilters, updateUrlParams],
  );

  const setType = useCallback(
    (type: ReportTypeFilter) => setFilters({ type, pos: 0 }),
    [setFilters],
  );

  const setDateRange = useCallback(
    (startDate: string, endDate: string) => setFilters({ startDate, endDate, pos: 0 }),
    [setFilters],
  );

  const setPage = useCallback(
    (pos: number, delta: number) => setFilters({ pos, delta }),
    [setFilters],
  );

  const reportType = (filters as ChildReportsFilters).type;
  const startDate = (filters as ChildReportsFilters).startDate;
  const endDate = (filters as ChildReportsFilters).endDate;
  const pos = Number((filters as ChildReportsFilters).pos ?? 0);
  const delta = Number((filters as ChildReportsFilters).delta ?? ITEMS_PER_PAGE);

  const queryKey: string[] = [
    "child-reports",
    String(childId ?? ""),
    reportType,
    startDate,
    endDate,
    String(pos),
    String(delta),
  ];

  const listEndpoint = childId != null
    ? studentReportDynamicEndpoints.listReports(childId)
    : null;

  const { data, isLoading, isFetching, refetch } = useQueryService<
    Record<string, unknown>,
    StudentReportListResponse
  >({
    service: {
      ...(listEndpoint ?? studentReportDynamicEndpoints.listReports(0)),
      data: {
        ...(reportType !== "all" ? { type: reportType } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        delta,
        pos,
      },
    },
    options: {
      keys: queryKey,
      enabled: !!childId,
    },
  });

  const reports: StudentReportDelivery[] = data?.data ?? [];
  const pagination: StudentReportListPagination = data?.pagination ?? {
    pos,
    delta,
    total: reports.length,
  };

  const currentPage = Math.floor((pagination.pos || 0) / (pagination.delta || delta)) + 1;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["child-reports", String(childId ?? "")] });
  }, [queryClient, childId]);

  // Trigger an Excel download of the currently filtered report list. We pass
  // through the same filters used for the list query so the export matches the
  // user's current view.
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (childId == null || isExporting) return;
    setIsExporting(true);
    try {
      const params: Record<string, string | number | undefined> = {};
      if (reportType !== "all") params.type = reportType;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      await downloadChildReportsExport(childId, params);
      showToast({
        message: "Export ready",
        description: "The reports list has been downloaded.",
        severity: "success",
        duration: 3000,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not export reports list.";
      showToast({
        message: "Export failed",
        description: message,
        severity: "error",
        duration: 3000,
      });
    } finally {
      setIsExporting(false);
    }
  }, [childId, endDate, isExporting, reportType, startDate]);

  return {
    isLoading,
    isFetching,
    reports,
    pagination,
    currentPage,
    filters: { type: reportType, startDate, endDate, pos, delta } as ChildReportsFilters,
    setType,
    setDateRange,
    setPage,
    refetch,
    invalidate,
    handleExport,
    isExporting,
  };
}
