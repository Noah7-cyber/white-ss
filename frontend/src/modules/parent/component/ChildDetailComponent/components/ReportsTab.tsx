"use client";

import { useParams } from "next/navigation";
import { Box } from "@mui/material";
import { ChildReports } from "@/modules/shared/component/ChildReportsComponent";

export default function ChildReportsTab() {
  const { id } = useParams() as { id: string };

  return (
    <Box className="flex flex-col gap-0">
      <ChildReports childId={id} userRole="parent" />
    </Box>
  );
}
