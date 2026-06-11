"use client";

import { Table } from "@/modules/shared/component/Table";
import { PaginationControls } from "@/modules/shared/component/Pagination/Pagination";
import { Box, Typography } from "@mui/material";
import useAdminsPage from "./hooks/useAdminsPage";
import { SearchTextfield } from "@/modules/shared/component/SearchTextfield";
import InitialsAvatar from "@/modules/shared/component/InitialsAvatar/InitialsAvatar";
import { SchoolFilter } from "@/components/SchoolFilter";

export default function AdminsPage() {
  const {
    adminsList,
    adminIds,
    pagination,
    isLoading,
    filters,
    applyFilters,
    handleSearch,
  } = useAdminsPage();

  return (
    <Box className="space-y-6 flex flex-col h-full p-4 md:p-5">
      <Box className="flex flex-wrap items-center justify-between gap-4">
        <Typography className="!text-2xl !font-means !text-secondary">
          System Admins
        </Typography>
        <SchoolFilter
          value={filters.schoolId}
          onChange={(schoolId) => applyFilters({ schoolId, pos: 0 })}
        />
      </Box>

      <Box className="bg-white rounded-lg shadow flex flex-col h-[75%] min-h-[500px]">
        <Box className="flex justify-between items-center p-4 border-b">
          <Typography className="font-semibold text-lg">Admins List</Typography>
          <SearchTextfield
            placeholder="Search admins"
            onChange={handleSearch}
          />
        </Box>
        <Box className="flex-1 overflow-auto">
          <Table
            headers={["Admin ID", "Name", "Email", "Role"]}
            isLoading={isLoading}
            data={adminsList.map((admin: { id: number, user: { firstName?: string, lastName?: string, email?: string, profile?: { photo?: string } }, role: string }) => [
              admin.id,
              <Box key={admin.id} className="flex items-center gap-3">
                <InitialsAvatar
                  firstName={admin.user?.firstName || ""}
                  lastName={admin.user?.lastName || ""}
                  photoUrl={admin.user?.profile?.photo}
                  className="w-10 h-10"
                />
                <Box>
                  <Typography className="!text-sm !font-semibold !text-primary-dark">
                    {admin.user?.firstName} {admin.user?.lastName}
                  </Typography>
                </Box>
              </Box>,
              admin.user?.email,
              admin.role,
            ])}
            onRowClick={() => {}}
          />
        </Box>
        {adminsList.length > 0 && (
          <Box className="p-4 border-t">
            <PaginationControls
              currentPage={Math.floor(pagination.pos / pagination.delta) + 1}
              totalPages={Math.ceil(pagination.count / pagination.delta)}
              onPageChange={(page) => {
                applyFilters({ pos: (page - 1) * pagination.delta });
              }}
              totalItems={pagination.count}
              itemsPerPage={pagination.delta}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
