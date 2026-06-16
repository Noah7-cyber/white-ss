"use client";

import React from "react";
import DashboardLayout from "@/layout/Shared/dashboardLayout"; // Update this layout in a separate PR if needed.
import { Box, Typography } from "@mui/material";

const AdminHome = () => {
  return (
    <DashboardLayout pageTitle="System Admin Dashboard">
      <Box className="p-6">
        <Typography variant="h4" className="font-bold text-gray-800 mb-4">
          Welcome to System Admin Dashboard
        </Typography>
        <Typography className="text-gray-600">
          From here you can manage platform settings, schools, and overall system metrics.
        </Typography>
      </Box>
    </DashboardLayout>
  );
};

export default AdminHome;
