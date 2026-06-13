"use client";

import { Table } from "@/modules/shared/component/Table";
import { PaginationControls } from "@/modules/shared/component/Pagination/Pagination";
import { InsightCard } from "@/components/InsightCard";
import { Box, Typography } from "@mui/material";
import PlusIcon from "@/modules/shared/assets/svgs/plus-icon.svg";
import { Button } from "@/modules/shared/component/Button";

import useTeachersPage from "./hooks/useTeachersPage";
import { DashboardRoutes } from "@/routes/dashboard.routes";
import { SearchTextfield } from "@/modules/shared/component/SearchTextfield";

export default function TeachersPage() {
  const {
    router,
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
    handleSearch,
    mobileTeachersData,
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

      <Box className="w-full flex items-center justify-between gap-4">
        <SearchTextfield
          onChange={handleSearch}
          placeholder="Search by name, subject, etc"
          isRounded
          fullWidth
          className="max-w-full md:w-96 md:max-w-112.5 bg-white rounded-full"
        />
        <div title="Read-Only Access">
          <Button
            className="!rounded-lg !hidden md:!flex whitespace-nowrap"
            startIcon={<PlusIcon />}
            onClick={() => router.push(DashboardRoutes.addTeacher)}
            disabled={true}
          >
            Add Teacher
          </Button>
        </div>
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


    </Box>
  );
}
