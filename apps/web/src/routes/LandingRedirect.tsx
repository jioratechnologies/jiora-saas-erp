import { Navigate } from "react-router-dom";
import { useMe } from "../auth/use-me";

/**
 * "/" has no fixed destination — platform staff (super_admin/developer/
 * maintainer) land on the Super Admin panel, tenant users land on their
 * Organisation page. Decided by GET /auth/me, not guessed client-side.
 */
export function LandingRedirect() {
  const { data: me, isLoading, notProvisioned, error } = useMe();

  if (isLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;

  if (notProvisioned) {
    return (
      <div className="max-w-lg p-6 text-sm">
        <p className="font-medium">No account found for this login.</p>
        <p className="mt-2 text-muted-foreground">
          You're signed in with Zitadel, but there's no matching user in saas-erp yet. Either
          you haven't been invited to a tenant, or (for platform staff) the platform role hasn't
          been bootstrapped for this account yet — see docs/onboarding/GETTING_STARTED.md step 6.
        </p>
      </div>
    );
  }

  if (error || !me) {
    return <p className="p-6 text-sm text-red-600">Couldn't reach the API. Is it running?</p>;
  }

  return <Navigate to={me.isPlatformContext ? "/platform/tenants" : "/admin/org"} replace />;
}
