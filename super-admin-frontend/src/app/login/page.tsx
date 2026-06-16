import LoginForm from "@/modules/system-admin/page/Login/loginForm";
import { SchoolLogoLoading } from "@/components/Loading/SchoolLogoLoading";
import React, { Suspense } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Admin Login",
};

const Page = () => {
  return (
    <Suspense fallback={<SchoolLogoLoading />}>
      <LoginForm />
    </Suspense>
  );
};

export default Page;
