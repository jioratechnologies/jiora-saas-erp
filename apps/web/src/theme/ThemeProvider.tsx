import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { useAuthStore } from "../auth/auth-store";
import { hexToHslTriple } from "./hex-to-hsl";

/**
 * Applies the current tenant's branding as CSS variables on <html> — the
 * mechanism behind white-labelling (see docs/adr/0008-theming-css-variables.md).
 * Platform users (no tenantId) get the default theme from src/index.css.
 * No rebuild needed to change a tenant's look: this just re-fetches
 * GET /admin/org and re-applies variables on login.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = Boolean(user);

  const { data: org } = useQuery({
    queryKey: ["org", "theme"],
    queryFn: () => api.get<Tenant>("/admin/org"),
    enabled: isLoggedIn,
    retry: false,
  });

  useEffect(() => {
    const root = document.documentElement;
    if (org?.primaryColor) {
      root.style.setProperty("--primary", hexToHslTriple(org.primaryColor));
    } else {
      root.style.removeProperty("--primary");
    }
  }, [org?.primaryColor]);

  return <>{children}</>;
}
