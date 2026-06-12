import { ApiMethods } from "@/utils/client";

const systemAdminAnalyticsRoot = "/api/v1/system-admin/analytics";

export interface SystemAdminDashboardAnalyticsResponse {
  success: boolean;
  message: string;
  data: {
    totalSchools: number;
    totalStudents: number;
    totalTeachers: number;
    totalClassrooms: number;
    totalParents: number;
  };
}

const systemAdminAnalyticsEndpoints = {
  getDashboardAnalytics: { path: `${systemAdminAnalyticsRoot}/dashboard`, method: ApiMethods.GET },
};

type ServiceInterface = {
  path: string;
  method: ApiMethods;
};

function generateServices<T extends Record<string, { path: string; method: ApiMethods }>>(
  endpoints: T,
) {
  const services: Record<keyof T, ServiceInterface> = {} as Record<keyof T, ServiceInterface>;
  for (const key in endpoints) {
    services[key] = {
      path: endpoints[key].path,
      method: endpoints[key].method,
    };
  }
  return services;
}

export const systemAdminAnalyticsServices = generateServices(systemAdminAnalyticsEndpoints);
