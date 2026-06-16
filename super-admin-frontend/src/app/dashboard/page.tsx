import AdminHome from "@/modules/system-admin/page/Dashboard/dashboard";
import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

const Page = () => {
  return <AdminHome />;
};

export default Page;
