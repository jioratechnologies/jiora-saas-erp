import { useAuthStore } from "../auth/auth-store";
import { formatErrorMessage } from "../lib/error-formatter";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public raw?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thin fetch wrapper: attaches the bearer token, throws client-friendly ApiError on non-2xx. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const accessToken = useAuthStore.getState().user?.access_token;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    const friendlyMessage = formatErrorMessage(rawText || res.statusText);
    throw new ApiError(res.status, friendlyMessage, rawText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Multipart/form-data upload wrapper: automatically attaches auth token & parses client-friendly error. */
async function upload<T>(path: string, formData: FormData, method: "POST" | "PATCH" | "PUT" = "POST"): Promise<T> {
  const accessToken = useAuthStore.getState().user?.access_token;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    const friendlyMessage = formatErrorMessage(rawText || res.statusText);
    throw new ApiError(res.status, friendlyMessage, rawText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, formData: FormData, method: "POST" | "PATCH" | "PUT" = "POST") => upload<T>(path, formData, method),
};

