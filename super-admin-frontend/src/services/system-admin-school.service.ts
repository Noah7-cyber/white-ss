import { ApiMethods } from "@/utils/client";

const systemAdminSchoolRoot = "/api/v1/system-admin/schools";

export interface SystemAdminSchool {
  id: number;
  schoolName: string;
  createdAt: string;
  updatedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface GetAllSchoolsResponse {
  success: boolean;
  message: string;
  data: {
    schools: SystemAdminSchool[];
    pagination: {
      pos: number;
      delta: number;
      count: number;
    };
  };
}

const schoolEndpoints = {
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

export const systemAdminSchoolServices = generateServices(schoolEndpoints);
