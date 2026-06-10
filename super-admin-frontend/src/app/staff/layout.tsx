"use client";
import { SessionProvider, useSession } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { StaffDashboardLayout } from "@/modules/staff/component/StaffDashboardLayout.tsx";
import { useRouter } from "next/navigation";
import { SchoolLogoLoading } from "@/components/Loading/SchoolLogoLoading";
import { getEffectiveRole, hasAccessToken, runRoleGuard } from "@/utils/auth/sessionGuards";

function StaffLayoutContent({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    router.replace("/admin/dashboard");
  }, [router]);

  return <SchoolLogoLoading />;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <StaffLayoutContent>{children}</StaffLayoutContent>
    </SessionProvider>
  );
}
