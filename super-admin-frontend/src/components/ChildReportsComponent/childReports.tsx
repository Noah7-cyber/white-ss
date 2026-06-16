/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { FC, useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import { Table } from "@/modules/shared/component/Table";
import { PaginationControls } from "@/modules/shared/component/Pagination/Pagination";
import { Button } from "@/modules/shared/component/Button";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { DateRangeModal } from "@/modules/shared/component/DateRangeModal";
import { dateFormatter } from "@/utils/helpers";
import { showToast } from "@/modules/shared/component/Toast";
import {
  StudentReportDelivery,
  StudentReportStatus,
  StudentReportTrigger,
  StudentReportType,
  downloadStudentReport,
} from "@/services/studentReport.service";
import { useChildReports, ReportTypeFilter } from "./hooks/useChildReports";
import ResendReportModal from "./components/ResendReportModal";

type UserRole = "admin" | "staff" | "parent" | string | undefined;

interface ChildReportsProps {
  childId: string | number;
  userRole?: UserRole;
}

const REPORT_TYPE_LABEL: Record<StudentReportType, string> = {
  daily_activity: "Daily activity",
  weekly_activity: "Weekly activity",
  selected_activities: "Manual selection",
};

const TYPE_FILTER_OPTIONS: Array<{ value: ReportTypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "daily_activity", label: "Daily" },
  { value: "weekly_activity", label: "Weekly" },
  { value: "selected_activities", label: "Manual selection" },
];

function StatusBadge({ status, sent, total }: { status: StudentReportStatus; sent: number; total: number }) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
  const palette =
    status === "sent"
      ? "bg-green-100 text-green-700"
      : status === "partial"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  const label = status === "sent" ? "Sent" : status === "partial" ? "Partial" : "Failed";

  return (
    <Box className="flex flex-col items-start gap-1">
      <span className={`${base} ${palette}`}>{label}</span>
      <span className="text-xs text-input-gray">
        {sent}/{total} delivered
      </span>
    </Box>
  );
}

function TriggerBadge({ trigger }: { trigger: StudentReportTrigger }) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
  const palette =
    trigger === "manual"
      ? "bg-[#E0F4F4] text-brandColor-active"
      : "bg-gray-100 text-gray-700";
  return <span className={`${base} ${palette}`}>{trigger === "manual" ? "Manual" : "Auto"}</span>;
}

function RecipientsCell({ recipients }: { recipients: StudentReportDelivery["recipients"] }) {
  const emails = (recipients ?? []).map((recipient) => recipient.email).filter(Boolean);
  if (emails.length === 0) {
    return <span className="text-xs text-input-gray">—</span>;
  }

  const joined = emails.join(", ");
  const isLong = joined.length > 40 || emails.length > 2;
  const display = isLong ? `${emails[0]}${emails.length > 1 ? ` +${emails.length - 1}` : ""}` : joined;

  return (
    <Tooltip title={joined} placement="top" arrow>
      <span className="text-xs text-secondary-text-gray cursor-default">{display}</span>
    </Tooltip>
  );
}

export const ChildReports: FC<ChildReportsProps> = ({ childId, userRole }) => {
  const {
    reports,
    pagination,
    currentPage,
    filters,
    isLoading,
    isFetching,
    setType,
    setDateRange,
    setPage,
    invalidate,
    handleExport,
    isExporting,
  } = useChildReports(childId);

  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadErrorByReport, setDownloadErrorByReport] = useState<Record<number, string>>({});
  const [resendTarget, setResendTarget] = useState<StudentReportDelivery | null>(null);

  const canResend = userRole !== "parent";

  // Build a lookup so the "Resent from #N" tag can render meaningful context within the page.
  const reportIndexById = useMemo(() => {
    const map = new Map<number, number>();
    reports.forEach((report, idx) => map.set(report.id, idx));
    return map;
  }, [reports]);

  const handleDownload = async (report: StudentReportDelivery) => {
    setDownloadingId(report.id);
    setDownloadErrorByReport((prev) => {
      const next = { ...prev };
      delete next[report.id];
      return next;
    });

    try {
      await downloadStudentReport(childId, report.id);
      showToast({
        message: "Report downloaded",
        description: "The PDF has been saved to your device.",
        severity: "success",
      });
    } catch (err: any) {
      const status: number | undefined = err?.status;
      if (status === 410) {
        const notice =
          "This report can no longer be downloaded — the source data has been deleted.";
        setDownloadErrorByReport((prev) => ({ ...prev, [report.id]: notice }));
        showToast({
          message: "Report unavailable",
          description: notice,
          severity: "warning",
        });
      } else {
        showToast({
          message: "Download failed",
          description: err?.message ?? "Could not download the report.",
          severity: "error",
        });
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const scrollToReport = (id: number) => {
    if (typeof document === "undefined") return;
    const target = document.querySelector(`[data-report-row="${id}"]`) as HTMLElement | null;
    if (target?.scrollIntoView) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring-2", "ring-brandColor-active");
      window.setTimeout(() => {
        target.classList.remove("ring-2", "ring-brandColor-active");
      }, 1500);
    }
  };

  const headers = [
    "Date",
    "Type",
    "Period",
    "Trigger",
    "Status",
    "Sender",
    "Recipients",
    "Actions",
  ];

  const tableData = reports.map((report) => {
    const parentDeliveryId = report.parentDeliveryId;
    const downloadErrorNote = downloadErrorByReport[report.id];

    return {
      Date: (
        <Box
          data-report-row={report.id}
          className="flex flex-col items-start gap-0.5"
        >
          <span className="text-sm text-[#101828]">
            {dateFormatter(report.createdAt, "D MMM YYYY h:mm A")}
          </span>
          {parentDeliveryId != null && (
            <button
              type="button"
              onClick={() => scrollToReport(parentDeliveryId)}
              className="text-[11px] text-brandColor-active hover:underline cursor-pointer"
            >
              Resent from #{parentDeliveryId}
            </button>
          )}
        </Box>
      ),
      Type: (
        <span className="text-sm text-secondary-text-gray">
          {REPORT_TYPE_LABEL[report.reportType] ?? report.reportType}
        </span>
      ),
      Period: (
        <span className="text-sm text-secondary-text-gray">{report.dateRangeLabel || "—"}</span>
      ),
      Trigger: <TriggerBadge trigger={report.trigger} />,
      Status: (
        <Box className="flex flex-col items-start gap-1">
          <StatusBadge
            status={report.status}
            sent={report.sentCount}
            total={report.recipientCount}
          />
          {downloadErrorNote && (
            <span className="text-[11px] text-red-600">{downloadErrorNote}</span>
          )}
        </Box>
      ),
      Sender: (
        <span className="text-sm text-secondary-text-gray">
          {report.senderName ?? (report.trigger === "auto" ? "System" : "—")}
        </span>
      ),
      Recipients: <RecipientsCell recipients={report.recipients} />,
      Actions: (
        <Box className="flex items-center justify-end gap-2">
          <Button
            variant="outlined"
            onClick={() => handleDownload(report)}
            loading={downloadingId === report.id}
            disabled={downloadingId === report.id}
            isRounded={false}
            className="rounded-lg! border! border-border-input! bg-white! text-secondary-text-gray! px-3! py-1.5! text-xs!"
            startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
          >
            Download
          </Button>
          {canResend && (
            <Button
              onClick={() => setResendTarget(report)}
              isRounded={false}
              className="rounded-lg! px-3! py-1.5! text-xs!"
            >
              Resend
            </Button>
          )}
        </Box>
      ),
    };
  });

  // Use the original report list (not indices) for mobile cards.
  const renderMobileCard = (_row: unknown, index: number) => {
    const report = reports[index];
    if (!report) return null;
    const parentDeliveryId = report.parentDeliveryId;
    const downloadErrorNote = downloadErrorByReport[report.id];

    return (
      <Box
        key={report.id}
        data-report-row={report.id}
        className="bg-white rounded-[16px] p-4 flex flex-col gap-3 mb-3 border border-[#EAECF0]"
      >
        <Box className="flex items-start justify-between gap-3">
          <Box className="flex flex-col gap-1 min-w-0">
            <Typography className="text-sm! font-semibold! text-[#101828]!">
              {REPORT_TYPE_LABEL[report.reportType] ?? report.reportType}
            </Typography>
            <Typography className="text-xs! text-input-gray!">
              {dateFormatter(report.createdAt, "D MMM YYYY h:mm A")}
            </Typography>
            {parentDeliveryId != null && (
              <button
                type="button"
                onClick={() => scrollToReport(parentDeliveryId)}
                className="text-[11px] text-brandColor-active hover:underline cursor-pointer text-left"
              >
                Resent from #{parentDeliveryId}
              </button>
            )}
          </Box>
          <Box className="flex flex-col items-end gap-1">
            <StatusBadge
              status={report.status}
              sent={report.sentCount}
              total={report.recipientCount}
            />
            <TriggerBadge trigger={report.trigger} />
          </Box>
        </Box>

        <Box className="flex flex-col gap-1.5 text-xs text-[#475467]">
          <Box className="flex items-start justify-between gap-3">
            <span className="text-input-gray">Period</span>
            <span className="text-right">{report.dateRangeLabel || "—"}</span>
          </Box>
          <Box className="flex items-start justify-between gap-3">
            <span className="text-input-gray">Sender</span>
            <span className="text-right">
              {report.senderName ?? (report.trigger === "auto" ? "System" : "—")}
            </span>
          </Box>
          <Box className="flex items-start justify-between gap-3">
            <span className="text-input-gray">Recipients</span>
            <span className="text-right max-w-[60%] truncate">
              <RecipientsCell recipients={report.recipients} />
            </span>
          </Box>
        </Box>

        {downloadErrorNote && (
          <Typography className="text-[11px]! text-red-600!">{downloadErrorNote}</Typography>
        )}

        <Box className="flex items-center justify-end gap-2 pt-1 border-t border-[#EAECF0]">
          <Button
            variant="outlined"
            onClick={() => handleDownload(report)}
            loading={downloadingId === report.id}
            disabled={downloadingId === report.id}
            isRounded={false}
            className="rounded-lg! border! border-border-input! bg-white! text-secondary-text-gray! px-3! py-1.5! text-xs!"
            startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
          >
            Download
          </Button>
          {canResend && (
            <Button
              onClick={() => setResendTarget(report)}
              isRounded={false}
              className="rounded-lg! px-3! py-1.5! text-xs!"
            >
              Resend
            </Button>
          )}
        </Box>
      </Box>
    );
  };

  const dateLabel =
    filters.startDate && filters.endDate
      ? `${dateFormatter(filters.startDate, "D MMM")} – ${dateFormatter(filters.endDate, "D MMM YYYY")}`
      : "Date range";

  return (
    <Box className="w-full rounded-2xl px-3 py-4 sm:px-5 md:p-6 bg-dashboard-bg md:bg-white">
      <Box className="flex flex-col gap-1 mb-4 md:mb-6">
        <Typography className="text-xl! font-bold! text-primary-text-dark mb-0">
          Reports
        </Typography>
        <Typography className="text-sm! font-light! text-text-gray mb-0">
          A history of every activity-summary email sent for this child.
        </Typography>
      </Box>

      <Box className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <Box className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.type}
            onChange={(event) => setType(event.target.value as ReportTypeFilter)}
            size="small"
            displayEmpty
            className="text-sm! rounded-lg! bg-white!"
            sx={{
              minWidth: 160,
              ".MuiOutlinedInput-notchedOutline": { borderColor: "#D0D5DD" },
            }}
          >
            {TYPE_FILTER_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value} className="text-sm!">
                {option.label}
              </MenuItem>
            ))}
          </Select>

          <button
            type="button"
            onClick={() => setDateRangeOpen(true)}
            className="rounded-lg border border-border-input bg-white text-sm text-secondary-text-gray px-3 py-2 hover:bg-gray-50 cursor-pointer"
          >
            {dateLabel}
          </button>

          {(filters.startDate || filters.endDate) && (
            <button
              type="button"
              onClick={() => setDateRange("", "")}
              className="text-xs text-brandColor-active hover:underline cursor-pointer"
            >
              Clear dates
            </button>
          )}
        </Box>

        <Box className="flex items-center gap-3">
          {isFetching && !isLoading && (
            <Box className="flex items-center gap-2 text-xs text-input-gray">
              <CircularProgress size={14} />
              <span>Refreshing…</span>
            </Box>
          )}
          <Button
            className="rounded-lg! !bg-white !text-[#02273A] !border !border-gray-200"
            onClick={handleExport}
            disabled={isExporting || reports.length === 0}
            startIcon={
              isExporting ? (
                <CircularProgress size={14} className="!text-[#02273A]" />
              ) : (
                <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
              )
            }
          >
            Export
          </Button>
        </Box>
      </Box>

      <Box className="w-full -mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto [scrollbar-width:thin]">
        <Box className="min-w-[860px] md:min-w-0">
          <Table
            headers={headers}
            tableData={tableData}
            isLoading={isLoading}
            headerRowClassName="!bg-[#F9FAFB] !border-b !border-[#E4E7EC] !text-sm"
            headerCellClassName="!text-left !text-dark font-avenir !font-medium"
            bodyCellClassName="!text-secondary-text-gray !text-md !font-medium font-avenir !text-left align-middle !py-3"
            bodyRowClassName="border-b border-[#E4E7EC] last:border-0"
            tableContainerClassName="!border !border-[#E4E7EC] !rounded-lg !overflow-hidden !bg-white"
            isCollapse
            isCondense
            rightAlignedIndex={[7]}
            renderMobileCard={renderMobileCard}
            preventRowClickColumnIndex={7}
          />
        </Box>
      </Box>

      <Box className="flex justify-center pt-4">
        <PaginationControls
          currentPage={currentPage}
          rowsPerPage={pagination.delta || filters.delta}
          totalItems={pagination.total || reports.length}
          onPageChange={({ page, rowsPerPage }) =>
            setPage((page - 1) * rowsPerPage, rowsPerPage)
          }
          isCondense
          bottomTableClasses="!text-xs"
        />
      </Box>

      <DateRangeModal
        open={dateRangeOpen}
        title="Filter by date range"
        startDate={filters.startDate}
        endDate={filters.endDate}
        onClose={() => setDateRangeOpen(false)}
        onApply={(start, end) => {
          setDateRange(start, end);
          setDateRangeOpen(false);
        }}
      />

      <ResendReportModal
        isOpen={!!resendTarget && canResend}
        onClose={() => setResendTarget(null)}
        studentId={childId}
        report={resendTarget}
        onResendComplete={invalidate}
      />
    </Box>
  );
};

export default ChildReports;
