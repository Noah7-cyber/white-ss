"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardRoutes } from "@/routes/dashboard.routes";
import {
  getToken,
  getUserRoleFromCookie,
  isOnAuthDomain,
  redirectToAuthRoute,
} from "@/utils/helper";
import { AuthRoutes } from "@/routes/auth.routes";

export default function HomePage() {
  const router = useRouter();

  function getEffectiveRole(): string | null {
    if (typeof window === "undefined") return null;
    const fromCookie = getUserRoleFromCookie();
    if (fromCookie) return fromCookie.toLowerCase();
    return null;
  }

  useEffect(() => {
    const token = getToken();

    if (token) {
      try {
        const userRole = getEffectiveRole();
        if (userRole) {
          if (userRole === "systemAdmin" || userRole === "systemadmin") {
            router.replace(DashboardRoutes.dashboard);
          } else {
            router.replace("/dashboard");
          }
        }
      } catch {
        router.replace("/dashboard");
      }
      return;
    }
    if (!isOnAuthDomain()) {
      if (redirectToAuthRoute(AuthRoutes.login)) return;
    }
    router.replace(AuthRoutes.login);
  }, [router]);

  return null;
}
