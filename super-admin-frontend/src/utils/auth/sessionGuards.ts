"use client";

import { redirectToAuthRoute, isOnAuthDomain, isSubdomainMismatch } from "@/utils/helper";

export type AppRole = "systemAdmin";

type GuardDecision =
  | { type: "allow" }
  | { type: "redirect"; target: string; crossDomain?: boolean };

export const QR_ROLE_BLOCKED_TOAST_KEY = "qr:role-blocked-toast";

const roleHomePath: Record<AppRole, string> = {
  systemAdmin: "/admin/dashboard",
};

const roleAuthPath: Record<AppRole, string> = {
  systemAdmin: "/auth/login",
};

function getCurrentPathWithQuery(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search ?? ""}`;
}

function buildRoleAuthTarget(requiredRole: AppRole): string {
  const authRoute = roleAuthPath[requiredRole];
  const currentPathWithQuery = getCurrentPathWithQuery();

  if (!currentPathWithQuery) return authRoute;
  return `${authRoute}?returnUrl=${encodeURIComponent(currentPathWithQuery)}`;
}

export function getEffectiveRole(): AppRole | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith("userRole="));
  if (!match) return null;
  const value = decodeURIComponent(match.split("=").slice(1).join("=").trim()).toLowerCase();
  if (value === "systemadmin") return "systemAdmin";
  return null;
}

export function hasAccessToken(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((row) => row.startsWith("accessToken="));
}

export function hasRefreshToken(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((row) => row.startsWith("refreshToken="));
}

export function shouldAttemptSessionRestore(): boolean {
  if (typeof document === "undefined") return false;
  const keepMeLoggedIn = document.cookie
    .split("; ")
    .find((row) => row.startsWith("keepMeLoggedIn="));
  const shouldKeepSession =
    keepMeLoggedIn &&
    decodeURIComponent(keepMeLoggedIn.split("=").slice(1).join("=").trim()) === "true";
  return Boolean(shouldKeepSession && hasRefreshToken());
}

export function evaluateRoleAccess(requiredRole: AppRole): GuardDecision {
  const authRoute = buildRoleAuthTarget(requiredRole);
  const token = hasAccessToken();
  const userRole = getEffectiveRole();

  if (isOnAuthDomain()) {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const isLocalhostVariant =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".localhost");
    if (!isLocalhostVariant) {
      return { type: "redirect", target: authRoute };
    }
  }

  if (isSubdomainMismatch()) {
    return { type: "redirect", target: authRoute, crossDomain: true };
  }

  if (!token || !userRole) {
    if (shouldAttemptSessionRestore()) {
      return { type: "allow" };
    }
    return { type: "redirect", target: authRoute, crossDomain: true };
  }

  if (userRole !== requiredRole) {
    return { type: "redirect", target: roleHomePath[userRole] };
  }

  return { type: "allow" };
}

export function runRoleGuard(requiredRole: AppRole, routerReplace: (path: string) => void): boolean {
  const decision = evaluateRoleAccess(requiredRole);
  if (decision.type === "allow") return true;

  if (decision.crossDomain && redirectToAuthRoute(decision.target)) {
    return false;
  }

  routerReplace(decision.target);
  return false;
}
