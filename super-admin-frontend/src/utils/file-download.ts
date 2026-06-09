/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosError } from "axios";
import { getSchoolFromCookie, getToken } from "@/utils/helper";

interface DownloadFileOptions {
  endpoint: string;
  params?: Record<string, string | number | undefined>;
  fallbackFilename: string;
  // Defaults to the Excel MIME type since that is the primary export format.
  accept?: string;
  // MIME used when the response body needs wrapping in a Blob locally.
  blobMimeType?: string;
}

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Issue a GET against the backend that returns a binary file, then trigger a
// browser download. Uses axios directly (instead of the shared client) so we
// can read response headers (Content-Disposition for the filename) and so we
// can parse JSON error payloads that come back as Blobs when responseType is
// "blob".
export async function downloadFile({
  endpoint,
  params,
  fallbackFilename,
  accept = XLSX_MIME,
  blobMimeType,
}: DownloadFileOptions): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const url = `${apiUrl.replace(/\/$/, "")}${endpoint}`;

  const token = getToken();
  const school = getSchoolFromCookie();
  const headers: Record<string, string> = { Accept: accept };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (school?.id != null) headers.school = String(school.id);

  try {
    const response = await axios.get<Blob>(url, {
      headers,
      params,
      responseType: "blob",
    });

    const blob =
      response.data instanceof Blob
        ? response.data
        : new Blob([response.data as unknown as ArrayBuffer], {
            type: blobMimeType ?? accept,
          });

    const disposition =
      (response.headers as any)?.["content-disposition"] ??
      (response.headers as any)?.get?.("content-disposition") ??
      null;
    const filename = extractFilename(disposition, fallbackFilename);

    triggerBrowserDownload(blob, filename);
  } catch (err) {
    // axios returns the error body as a Blob when responseType is "blob".
    // Re-throw with a readable message so the caller can show a useful toast.
    const parsed = await parseBlobErrorMessage(err);
    if (parsed) {
      throw new Error(parsed);
    }
    throw err;
  }
}

function extractFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain filename branch
    }
  }
  const plainMatch = /filename=("?)([^";]+)\1/i.exec(disposition);
  if (plainMatch?.[2]) return plainMatch[2].trim();
  return fallback;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5_000);
}

async function parseBlobErrorMessage(err: unknown): Promise<string | null> {
  const axiosErr = err as AxiosError | undefined;
  const data = axiosErr?.response?.data;
  if (!data) return null;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      try {
        const parsed = JSON.parse(text);
        return parsed?.message ?? parsed?.error ?? null;
      } catch {
        return text || null;
      }
    } catch {
      return null;
    }
  }
  if (typeof data === "string") return data;
  if (typeof (data as any)?.message === "string") return (data as any).message;
  return null;
}
