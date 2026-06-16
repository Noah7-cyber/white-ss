import { ApiMethods } from "@/utils/client";
import { User } from "@/redux/store/slices/authSlice";

const root = "/api/v1/system-admin/auth";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: { user: User };
  status: string;
  message: string;
  user?: User;
  accessToken: string;
  refreshToken: string;
}

export interface LogoutResponse {
  status: string;
  message: string;
}

const endpoints = {
  login: { path: `${root}/login`, method: ApiMethods.POST },
  logout: { path: `/api/v1/auth/logout`, method: ApiMethods.POST },
};

function generateServices<T extends Record<string, { path: string; method: ApiMethods }>>(
  endpoints: T,
) {
  const services: Record<keyof T, { path: string; method: ApiMethods }> = {} as any;
  for (const key in endpoints) {
    services[key] = {
      path: endpoints[key].path,
      method: endpoints[key].method,
    };
  }
  return services;
}

export const systemAdminAuthServices = generateServices(endpoints);
