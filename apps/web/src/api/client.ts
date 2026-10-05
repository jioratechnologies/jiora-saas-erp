import { getValidAccessToken, useAuthStore } from "../auth/auth-store";
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

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";
const EXPIRY_REDIRECT_KEY = "auth:expiry-redirect-at";

/** Flags the session as expired and sends the user to sign in (once; never from /callback or /login). */
async function handleSessionExpired(): Promise<never> {
  useAuthStore.setState({ sessionExpired: true });
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (path !== "/callback" && path !== "/login") {
    let recentlyRedirected = false;
    try {
      const last = Number(sessionStorage.getItem(EXPIRY_REDIRECT_KEY) ?? 0);
      recentlyRedirected = Date.now() - last < 30_000;
      if (!recentlyRedirected) sessionStorage.setItem(EXPIRY_REDIRECT_KEY, String(Date.now()));
    } catch {
      // storage unavailable: still redirect once per call
    }
    if (!recentlyRedirected) {
      useAuthStore.getState().signIn().catch(() => {});
    }
  }
  throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
}

/**
 * fetch with a valid bearer token. On 401 (request not processed) forces one token
 * refresh and retries exactly once; if that still fails the session is treated as expired.
 */
async function authedFetch(path: string, build: (token: string | null) => RequestInit): Promise<Response> {
  const token = await getValidAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, build(token));
  if (res.status !== 401) return res;

  const refreshed = token ? await getValidAccessToken({ force: true }) : null;
  if (!refreshed) return handleSessionExpired();
  const retry = await fetch(`${API_BASE_URL}${path}`, build(refreshed));
  if (retry.status === 401) return handleSessionExpired();
  return retry;
}

/** Thin fetch wrapper: attaches the bearer token, throws client-friendly ApiError on non-2xx. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await authedFetch(path, (accessToken) => ({
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));

  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    const friendlyMessage = formatErrorMessage(rawText || res.statusText);
    throw new ApiError(res.status, friendlyMessage, rawText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Authenticated binary download (e.g. a document's bytes). */
async function getBlob(path: string): Promise<Blob> {
  const res = await authedFetch(path, (accessToken) => ({
    method: "GET",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  }));
  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    throw new ApiError(res.status, formatErrorMessage(rawText || res.statusText), rawText);
  }
  return res.blob();
}

/** Multipart/form-data upload wrapper: automatically attaches auth token & parses client-friendly error. */
async function upload<T>(path: string, formData: FormData, method: "POST" | "PATCH" | "PUT" = "POST"): Promise<T> {
  const res = await authedFetch(path, (accessToken) => ({
    method,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  }));

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
  getBlob: (path: string) => getBlob(path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, formData: FormData, method: "POST" | "PATCH" | "PUT" = "POST") => upload<T>(path, formData, method),
};

