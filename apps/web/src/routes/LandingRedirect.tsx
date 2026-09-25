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

  if (me.isPlatformContext) {
    return <Navigate to="/platform/tenants" replace />;
  }

  // Route to authorized HR or Admin modules
  if (me.permissionKeys.includes("hr.person.read")) {
    return <Navigate to="/hr/people" replace />;
  }
  if (me.permissionKeys.includes("hr.attendance.read")) {
    return <Navigate to="/hr/attendance" replace />;
  }
  if (me.permissionKeys.includes("hr.leave.read")) {
    return <Navigate to="/hr/leave" replace />;
  }
  if (me.permissionKeys.includes("hr.holiday.read")) {
    return <Navigate to="/hr/holidays" replace />;
  }

  // Admin modules
  if (me.permissionKeys.includes("admin.org.read")) {
    return <Navigate to="/admin/org" replace />;
  }
  if (me.permissionKeys.includes("admin.department.read")) {
    return <Navigate to="/admin/departments" replace />;
  }
  if (me.permissionKeys.includes("admin.designation.read")) {
    return <Navigate to="/admin/designations" replace />;
  }
  if (me.permissionKeys.includes("admin.role.read")) {
    return <Navigate to="/admin/roles" replace />;
  }
  if (me.permissionKeys.includes("admin.user.read")) {
    return <Navigate to="/admin/users" replace />;
  }

  // Welcome state for roles without specific page permissions
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md text-center p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Welcome to saas-erp</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in with the{" "}
          <strong className="text-foreground">{me.roles && me.roles.length > 0 ? me.roles.join(", ") : "Member"}</strong> role.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Please contact your organisation administrator if you need access to specific HR or operational modules.
        </p>
      </div>
    </div>
  );
}
