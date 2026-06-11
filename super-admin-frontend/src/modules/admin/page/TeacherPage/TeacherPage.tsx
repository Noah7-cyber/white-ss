"use client";

import { Table } from "@/modules/shared/component/Table";
import { PaginationControls } from "@/modules/shared/component/Pagination/Pagination";
import { InsightCard } from "@/components/InsightCard";
import { Box, Typography } from "@mui/material";
import PlusIcon from "@/modules/shared/assets/svgs/plus-icon.svg";
import { Button } from "@/modules/shared/component/Button";

import useTeachersPage from "./hooks/useTeachersPage";
import { DashboardRoutes } from "@/routes/dashboard.routes";
import ConfirmModal from "@/components/ConfirmModal/confirmModal";
import TrashIcon from "@/modules/shared/assets/svgs/trashicon.svg";
import WarnIcon from "@/modules/shared/assets/svgs/warnIcon.svg";
import { SearchTextfield } from "@/modules/shared/component/SearchTextfield";
import { CWDropdown } from "@/modules/shared/component/FormFields/CWDropdown";
import { useSystemAdminSchools } from "@/utils/hooks/useSystemAdminSchools";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import { useState } from "react";

export default function TeachersPage() {
  const { schoolOptions } = useSystemAdminSchools();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const {
    router,
    deactivateModalOpen,
    deleteModalOpen,
    handleDeactivate,
    handleDelete,
    setDeactivateModalOpen,
    setDeleteModalOpen,
    filters,
    applyFilters,
    TeacherList,
    teacherIds,
    currentPage,
    isLoading,
    totalStaff,
    totalStaffCount,
    leadTeachersCount,
    assistantTeachersCount,
    pagination,
    isDeactivatingTeacher,
    isDeletingTeacher,
    handleSearch,
    selectedTeacherStatus,
    mobileTeachersData,
    canCreateTeacher,
    handleExport,
    isExporting,
  } = useTeachersPage();

  const handleRowClick = (_rowData: unknown, rowIndex: number) => {
    const id = teacherIds?.[rowIndex];
    if (id != null) router.push(`${DashboardRoutes.teachers}/${id}`);
  };

  return (
    <Box className="p-5 flex flex-col gap-6">
      <Box className="hidden md:flex items-center justify-between">
        <Typography className="!text-xl !font-semibold">Teachers</Typography>
      </Box>

      <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto md:overflow-x-visible hide-scrollbar min-h-20 md:min-h-35 *:shrink-0 md:*:shrink">
        <InsightCard
          name="Total Teachers"
          value={totalStaffCount || totalStaff || 0}
          className="h-16 md:h-35 !min-w-52 md:min-w-0 border! border-[#00808033]! rounded-lg!"
        />
        <InsightCard
          name="Currently Present"
          value={totalStaff || 0}
          className="h-16 md:h-35 !min-w-52 md:min-w-0 border! border-[#00808033]! rounded-lg!"
        />
        <InsightCard
          name="Lead Teachers"
          value={leadTeachersCount || 0}
          className="h-20 md:h-35 min-w-52 md:min-w-0 border! border-[#00808033]! rounded-lg!"
        />
        <InsightCard
          name="Assistant Teachers"
          value={assistantTeachersCount || 0}
          className="h-20 md:h-35 min-w-52 md:min-w-0 border! border-[#00808033]! rounded-lg!"
        />
      </div>

      <Box className="w-full flex items-center justify-between gap-4 flex-wrap">
        <div className="w-full lg:w-auto max-w-md flex-1">
          <SearchTextfield
            onChange={handleSearch}
            placeholder="Search by name, subject, etc"
            isRounded
            fullWidth
            className="max-w-full bg-white rounded-full"
          />
        </div>

        <Box className="flex gap-3 w-full lg:w-auto overflow-x-auto hide-scrollbar">
          <Box className="w-48 shrink-0">
            <CWDropdown
              options={schoolOptions.map((o) => ({ name: o.label, value: o.value }))}
              value={selectedSchoolId}
              onSelect={(val) => {
                setSelectedSchoolId(val as string);
                applyFilters({ schoolId: val ? Number(val) : undefined });
              }}
              textFieldProps={{
                placeholder: "All Schools",
                isRounded: true,
                inputClasses: "!bg-white"
              }}
            />
          </Box>
          <Button
            className="rounded-lg! !bg-white !text-[#02273A] !border !border-gray-200 shrink-0"
            onClick={handleExport}
            disabled={isExporting}
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
          <Button
            className="!rounded-lg !hidden md:!flex whitespace-nowrap shrink-0"
            startIcon={<PlusIcon />}
            onClick={() => router.push(DashboardRoutes.addTeacher)}
            disabled={true}
            title="Read-Only Access"
          >
            Add Teacher
          </Button>
        </Box>
      </Box>

      <div className="md:hidden flex flex-col gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#E4E7EC] bg-white p-4 h-24 animate-pulse"
              />
            ))
          : mobileTeachersData?.map((teacher: { id: number; name: string; classes: string }) => (
              <button
                key={teacher.id}
                type="button"
                onClick={() => router.push(`${DashboardRoutes.teachers}/${teacher.id}`)}
                className="w-full rounded-xl border border-[#E4E7EC] bg-white p-4 text-left"
              >
                <div className="font-semibold text-sm text-text-primary">{teacher.name}</div>
                <div className="mt-3 text-xs text-text-secondary truncate">{teacher.classes}</div>
              </button>
            ))}
        {mobileTeachersData?.length && (
          <PaginationControls
            currentPage={currentPage}
            rowsPerPage={filters?.delta}
            totalItems={pagination?.count}
            onPageChange={(event) => {
              applyFilters({
                pos: (event?.page - 1) * event?.rowsPerPage,
                delta: event?.rowsPerPage,
              });
            }}
            isCondense
            bottomTableClasses="!text-xs"
          />
        )}
      </div>

      <Box className="hidden md:block !pb-4 rounded-xl">
        <Box className="bg-white rounded-xl border !border-border-table">
          <Table
            headers={[" Name", "Subject", "Classes", "Address", "Status", "Action"]}
            tableData={TeacherList}
            onRowClick={handleRowClick}
            preventRowClickColumnIndex={5}
            isCollapse
            centeredHeaderIndex={[4]}
            rightAlignedIndex={[5]}
            className="relative"
            isLoading={isLoading}
          />
        </Box>

        <Box className="flex justify-center pt-4">
          <PaginationControls
            currentPage={currentPage}
            rowsPerPage={filters?.delta}
            totalItems={pagination?.count}
            onPageChange={(event) => {
              applyFilters({
                pos: (event?.page - 1) * event?.rowsPerPage,
                delta: event?.rowsPerPage,
              });
            }}
            isCondense
            bottomTableClasses="!text-xs"
          />
        </Box>
      </Box>

      <ConfirmModal
        open={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        onConfirm={handleDeactivate}
        icon={<WarnIcon />}
        title={
          String(selectedTeacherStatus || "").toLowerCase() === "active"
            ? "Are you sure you want to deactivate this teacher?"
            : "Are you sure you want to activate this teacher?"
        }
        description={
          String(selectedTeacherStatus || "").toLowerCase() === "active"
            ? "You will be able to reactivate this teacher later."
            : "This teacher will be able to access active features again."
        }
        confirmLabel={
          String(selectedTeacherStatus || "").toLowerCase() === "active" ? "Deactivate" : "Activate"
        }
        cancelLabel="Cancel"
        loading={isDeactivatingTeacher}
      />

      <ConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        icon={<TrashIcon />}
        title="Are you sure you want to delete this teacher?"
        description="This action cannot be undone. Once deleted, all related data will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={isDeletingTeacher}
      />
    </Box>
  );
}
