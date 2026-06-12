import { ApiMethods } from "@/utils/client";

const parentRoot = "/api/v1/system-admin/parents";

export const systemAdminParentEndpoints = {
  getAllParents: { path: `${parentRoot}`, method: ApiMethods.GET },
};

export const systemAdminParentDynamicEndpoints = {
  getParentById: (id: string | number) => ({
    path: `${parentRoot}/${id}`,
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

export const systemAdminParentServices = generateServices(systemAdminParentEndpoints);
import { downloadFile } from "@/utils/file-download";

export async function downloadSystemAdminParentsExport(
  params?: Record<string, string | number | undefined>,
): Promise<void> {
  const fallback = `parents-${new Date().toISOString().split("T")[0]}.xlsx`;
  await downloadFile({
    endpoint: `${parentRoot}/export`,
    params,
    fallbackFilename: fallback,
  });
}
