import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";
import { useAuthStore } from "./auth-store";

export interface AvailableTenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

export interface Me {
  userId: string;
  tenantId: string | null;
  isPlatformContext: boolean;
  roles?: string[];
  permissionKeys: string[];
  availableTenants?: AvailableTenant[];
}

/**
 * "Who am I" — drives routing (platform staff -> /platform/tenants, tenant
 * users -> /admin/org) and nav visibility. See GET /auth/me on the backend.
 *
 * A 401 here means: verified Zitadel identity, but no app-side User row for
 * it — not logged into a broken app, just genuinely no account yet (not
 * invited to any tenant, not a platform user). Surfaced as `notProvisioned`
 * so the UI can say that plainly instead of spinning forever.
 */
export function useMe() {
  const isLoggedIn = Boolean(useAuthStore((s) => s.user));
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<Me>("/auth/me"),
    enabled: isLoggedIn,
    // Retry up to 2 times for network-level failures (ECONNREFUSED, fetch
    // failures on first container startup) but never retry auth errors
    // (401 = not provisioned, 403 = forbidden — retrying won't help).
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const notProvisioned = query.error instanceof ApiError && query.error.status === 401;
  return { ...query, notProvisioned };
}
