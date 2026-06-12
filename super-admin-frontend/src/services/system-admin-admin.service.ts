import { ApiMethods } from "@/utils/client";

const adminRoot = "/api/v1/system-admin/admins";

export const systemAdminAdminEndpoints = {
  getAllAdmins: { path: `${adminRoot}`, method: ApiMethods.GET },
};

export const systemAdminAdminDynamicEndpoints = {
  getAdminById: (id: string | number) => ({
    path: `${adminRoot}/${id}`,
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

export const systemAdminAdminServices = generateServices(systemAdminAdminEndpoints);
