"use client";

import { useQueryService } from "@/utils/hooks/useQueryService";
import { systemAdminSchoolServices, SystemAdminSchool } from "@/services/system-admin-school.service";
import { Dropdown } from "@/modules/shared/component/Dropdown";
import { useMemo } from "react";
import { Box, Typography } from "@mui/material";

interface SchoolFilterProps {
  value: number | undefined;
  onChange: (schoolId: number | undefined) => void;
  className?: string;
}

export const SchoolFilter = ({ value, onChange, className }: SchoolFilterProps) => {
  const { data, isLoading } = useQueryService<any, any>({
    service: systemAdminSchoolServices.getAllSchools,
    queryOptions: {
      pos: 0,
      delta: 1000,
    },
  });

  const schools: SystemAdminSchool[] = data?.data?.schools || [];

  const options = useMemo(() => {
    const allOptions = [
      { name: "All Schools", value: undefined },
      ...schools.map((school) => ({
        name: school.schoolName,
        value: school.id,
      })),
    ];
    return allOptions;
  }, [schools]);

  return (
    <Box className={className} sx={{ minWidth: 200 }}>
      <Dropdown
        isForm
        hasSearch
        selected={value}
        onSelect={(val) => onChange(val as number | undefined)}
        options={options}
        isLoading={isLoading}
        textFieldProps={{
          placeholder: "Select School",
        }}
      />
    </Box>
  );
};
