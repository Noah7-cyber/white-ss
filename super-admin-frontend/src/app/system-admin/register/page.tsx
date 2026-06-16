import SystemAdminAcceptInvitationForm from "@/modules/systemAdmin/page/Register/systemAdminAcceptInvitationForm";
import React, { Suspense } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Admin Register",
};

const Page = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SystemAdminAcceptInvitationForm />
    </Suspense>
  );
};

export default Page;