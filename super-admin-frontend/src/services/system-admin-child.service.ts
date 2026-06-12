import { ApiMethods } from "@/utils/client";

const childRoot = "/api/v1/system-admin/students";

export const systemAdminChildEndpoints = {
  getAllChilds: { path: `${childRoot}`, method: ApiMethods.GET },
};

export const systemAdminChildDynamicEndpoints = {
  getChildById: (id: string | number) => ({
    path: `${childRoot}/${id}`,
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

export const systemAdminChildServices = generateServices(systemAdminChildEndpoints);
import { downloadFile } from "@/utils/file-download";

export async function downloadSystemAdminChildrenExport(
  params?: Record<string, string | number | undefined>,
): Promise<void> {
  const fallback = `students-${new Date().toISOString().split("T")[0]}.xlsx`;
  await downloadFile({
    endpoint: `${childRoot}/export`,
    params,
    fallbackFilename: fallback,
  });
}
