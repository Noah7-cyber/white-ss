/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-constraint */

import axios, { AxiosHeaders, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { sessionEventEmitter } from "./eventEmitters";
import { debounceHandler } from "./debounceHandler";
import {
  getKeepMeLoggedInPreference,
  getToken,
  getRefreshTokenFromCookie,
  setAuthTokenCookies,
  isAccessTokenExpired,
} from "./helper";

const AUTH_REFRESH_PATH = "/api/v1/auth/refresh";
const AUTH_NO_SCHOOL_HEADER_PATHS = [
  "/api/v1/system-admin/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/refresh",
];
const shouldSkipAuthRefresh = (url?: string) => {
  if (!url) return false;
  return AUTH_NO_SCHOOL_HEADER_PATHS.some((path) => url.includes(path));
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export enum ApiMethods {
  GET = "get",
  POST = "post",
  PUT = "put",
  DELETE = "delete",
  PATCH = "patch",
}

export interface ClientRequestConfig<Req extends unknown> {
  path: string;
  method: ApiMethods;
  isEncrypted?: boolean;
  baseUrl?: string;
  headers?: Record<string, any>;
  responseType?: "json" | "blob";
  data?: Req;
  options?: {
    isDownload?: boolean;
    canShare?: boolean;
    isPdf?: boolean;
    fileName?: string;
    isFormData?: boolean;
    isCsv?: boolean;
    isXlsx?: boolean;
  };
}

interface DefaultHeadersProps {
  Authorization?: string;
  Accept?: string;
  "Cache-Control"?: string;
  "Content-Type"?: string;
  "api-secret"?: string;
}

export interface ClientInstanceConfig<Resp extends object> {
  baseUrl?: string;
  transformResponse?: () => Resp;
}

export class Client<Response extends object> {
  http: AxiosInstance | null = null;
  axiosConfig = {};

  constructor(config?: ClientInstanceConfig<Response>) {
    this.create(config);
  }

  async request<Req = unknown, Resp = unknown>(config: ClientRequestConfig<Req>): Promise<Resp> {
    if (!this.http) {
      throw new Error(
        "Client not initialized. Please create a new Client instance with configuration.",
      );
    }

    const payloadFormat = {
      [ApiMethods.GET]: "params",
      [ApiMethods.POST]: "data",
      [ApiMethods.PUT]: "data",
      [ApiMethods.PATCH]: "data",
      [ApiMethods.DELETE]: "data",
    };

    const defaultHeaders: DefaultHeadersProps = {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    };

    const { options } = config || {};

    if (options?.isPdf) defaultHeaders["Content-Type"] = "application/pdf";
    if (options?.isFormData) delete defaultHeaders["Content-Type"];
    if (options?.isCsv) defaultHeaders["Content-Type"] = "text/csv";
    if (options?.isXlsx)
      defaultHeaders["Content-Type"] =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    interface AxiosRequestConfigTyped<Req = unknown> {
      url: string;
      method: ApiMethods;
      headers: Record<string, any>;
      baseURL?: string;
      responseType?: "json" | "blob";
      params?: Req;
      data?: Req;
    }

    interface AxiosResponseTyped<Resp extends unknown> {
      data: Resp;
      status: number;
      statusText: string;
      headers: Record<string, any>;
      config: object;
      request?: any;
    }

    return this.http
      .request<AxiosRequestConfigTyped<Req>, AxiosResponseTyped<Resp>>({
        url: config.path,
        method: config.method,
        headers: { ...defaultHeaders, ...config.headers },
        baseURL: config.baseUrl || apiUrl,
        responseType: !options?.isDownload && !options?.isPdf ? "json" : "blob",
        [payloadFormat[config.method]]: config.data,
      })
      .then(({ data }: AxiosResponseTyped<Resp>) => data)
      .then(async (jsonResponse: any) => {
        if (!(jsonResponse as any).arrayBuffer) return jsonResponse;
        return window.URL.createObjectURL(jsonResponse as any);
      })
      .catch((err: any) => {
        const errorResponse: any = err.response?.data;

        if (err.response?.status === 401) {
          debounceHandler(() => {
            sessionEventEmitter.emit("unauthorized", {});
          }, 300);
        }

        return Promise.reject(errorResponse || err);
      });
  }

  create<Resp extends object = Response>(config?: ClientInstanceConfig<Resp>) {
    this.http = axios.create({
      baseURL: config?.baseUrl || apiUrl,
      transformResponse: config?.transformResponse,
      ...this.axiosConfig,
    });

    let pendingRefreshPromise: Promise<string> | null = null;
    const refreshAccessToken = async () => {
      try {
        const refreshToken = getRefreshTokenFromCookie();
        if (!refreshToken) return null;
        const accessToken = pendingRefreshPromise
          ? await pendingRefreshPromise
          : await (pendingRefreshPromise = (async () => {
              const res = await axios.post<{ accessToken: string; refreshToken?: string }>(
                `${apiUrl?.replace(/\/$/, "")}${AUTH_REFRESH_PATH}`,
                { refreshToken },
                { headers: { "Content-Type": "application/json" } },
              );
              const payload = (res.data as any)?.data ?? res.data;
              const nextAccessToken = payload?.accessToken;
              const nextRefreshToken = payload?.refreshToken;
              if (nextAccessToken) {
                const keepMeLoggedIn = getKeepMeLoggedInPreference();
                setAuthTokenCookies({
                  accessToken: nextAccessToken,
                  ...(nextRefreshToken && { refreshToken: nextRefreshToken }),
                }, {
                  persistent: keepMeLoggedIn,
                });
              }
              return nextAccessToken;
            })().finally(() => {
              pendingRefreshPromise = null;
            }));
        return accessToken ?? null;
      } catch {
        pendingRefreshPromise = null;
        return null;
      }
    };

    this.http.interceptors.request.use(
      async (reqConfig: InternalAxiosRequestConfig & { _skipRefresh?: boolean }) => {
        const headers = AxiosHeaders.from(reqConfig.headers);
        reqConfig.headers = headers;
        const isRefreshRequest =
          typeof reqConfig.url === "string" && reqConfig.url.includes(AUTH_REFRESH_PATH);
        if (isRefreshRequest) {
          reqConfig._skipRefresh = true;
        }
        if (!isRefreshRequest) {
          const token = getToken();
          if (!headers.has("Authorization") && token) {
            headers.set("Authorization", `Bearer ${token}`);
          }
        }
        return reqConfig;
      },
    );

    this.http.interceptors.response.use(
      (response) => response,
      async (err: any) => {
        const requestConfig = err.config as InternalAxiosRequestConfig & { _skipRefresh?: boolean };
        const requestUrl = typeof requestConfig?.url === "string" ? requestConfig.url : "";
        const isAuthEndpoint = shouldSkipAuthRefresh(requestUrl);
        if (err.response?.status !== 401 || requestConfig._skipRefresh || isAuthEndpoint) {
          return Promise.reject(err);
        }
        const keepMeLoggedIn = getKeepMeLoggedInPreference();
        if (!keepMeLoggedIn) {
          debounceHandler(() => sessionEventEmitter.emit("unauthorized", {}), 300);
          return Promise.reject(err);
        }

        try {
          const newAccessToken = await refreshAccessToken();
          if (!newAccessToken) {
            throw err;
          }
          requestConfig.headers = AxiosHeaders.from(requestConfig.headers);
          requestConfig.headers.set("Authorization", `Bearer ${newAccessToken}`);
          requestConfig._skipRefresh = true;
          return this.http!.request(requestConfig);
        } catch {
          pendingRefreshPromise = null;
          debounceHandler(() => sessionEventEmitter.emit("unauthorized", {}), 300);
          return Promise.reject(err);
        }
      },
    );
  }
}

const client = new Client();

export default client;
