import { ApiMethods } from "@/utils/client";

const teacherRoot = "/api/v1/system-admin/staff";

export const systemAdminTeacherEndpoints = {
  getAllTeachers: { path: `${teacherRoot}`, method: ApiMethods.GET },
};

export const systemAdminTeacherDynamicEndpoints = {
  getTeacherById: (id: string | number) => ({
    path: `${teacherRoot}/${id}`,
    method: ApiMethods.GET,
  }),
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

export const systemAdminTeacherServices = generateServices(systemAdminTeacherEndpoints);
