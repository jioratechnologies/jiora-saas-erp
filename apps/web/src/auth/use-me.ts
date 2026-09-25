import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";
import { useAuthStore } from "./auth-store";

export interface Me {
  userId: string;
  tenantId: string | null;
  isPlatformContext: boolean;
  roles?: string[];
  permissionKeys: string[];
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
    retry: false,
    staleTime: 0,           // always treat as stale so permissions are never served from cache
    refetchOnWindowFocus: true, // re-fetch when user switches back to tab
  });

  const notProvisioned = query.error instanceof ApiError && query.error.status === 401;
  return { ...query, notProvisioned };
}
