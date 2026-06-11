import { ApiMethods } from "@/utils/client";

const classroomRoot = "/api/v1/system-admin/classrooms";

export const systemAdminClassroomEndpoints = {
  getAllClassrooms: { path: `${classroomRoot}`, method: ApiMethods.GET },
};

export const systemAdminClassroomDynamicEndpoints = {
  getClassroomById: (id: string | number) => ({
    path: `${classroomRoot}/${id}`,
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

export const systemAdminClassroomServices = generateServices(systemAdminClassroomEndpoints);
