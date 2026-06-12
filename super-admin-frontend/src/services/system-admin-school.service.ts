import { ApiMethods } from "@/utils/client";

const systemAdminSchoolRoot = "/api/v1/system-admin/schools";

export interface SystemAdminSchool {
  id: number;
  schoolName: string;
  schoolLogoUrl?: string | null;
}

export interface GetSystemAdminSchoolsResponse {
  success: boolean;
  message: string;
  data?: {
    schools: SystemAdminSchool[];
    pagination: {
      pos: number;
      delta: number;
      count: number;
    };
  };
}

const systemAdminSchoolEndpoints = {
  getAllSchools: { path: `${systemAdminSchoolRoot}`, method: ApiMethods.GET },
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

export const systemAdminSchoolServices = generateServices(systemAdminSchoolEndpoints);
