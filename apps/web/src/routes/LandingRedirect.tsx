import { Navigate } from "react-router-dom";
import { Loader2, UserX } from "lucide-react";
import { useMe } from "../auth/use-me";
import { Alert, AlertDescription } from "../components/ui/alert";

/**
 * "/" has no fixed destination — platform staff (super_admin/developer/
 * maintainer) land on the Super Admin panel, tenant users land on their
 * Organisation page. Decided by GET /auth/me, not guessed client-side.
 */
export function LandingRedirect() {
  const { data: me, isLoading, notProvisioned, error } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (notProvisioned) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <UserX className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No account found for this login</p>
          <p className="mt-2 text-sm text-muted-foreground">
            You're signed in with Zitadel, but there's no matching user in saas-erp yet. Either you
            haven't been invited to a tenant, or (for platform staff) the platform role hasn't been
            bootstrapped for this account yet — see{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              docs/onboarding/GETTING_STARTED.md
            </code>{" "}
            step 6.
          </p>
        </div>
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>Couldn't reach the API. Is it running?</AlertDescription>
        </Alert>
      </div>
    );
  }

  return <Navigate to={me.isPlatformContext ? "/platform/tenants" : "/admin/org"} replace />;
}
