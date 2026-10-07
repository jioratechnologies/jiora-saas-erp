import { Navigate } from "react-router-dom";
import { Loader2, UserX, RefreshCw, LogOut, WifiOff, ServerCrash } from "lucide-react";
import { useMe } from "../auth/use-me";
import { useAuthStore } from "../auth/auth-store";
import { Button } from "../components/ui/button";

/**
 * "/" has no fixed destination — platform staff (super_admin/developer/
 * maintainer) land on the Super Admin panel, tenant users land on their
 * Organisation page. Decided by GET /auth/me, not guessed client-side.
 */
export function LandingRedirect() {
  const { data: me, isLoading, isFetching, notProvisioned, error, refetch, failureCount } = useMe();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);

  if (isLoading || isFetching) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">Connecting to your workspace…</p>
          <p className="text-xs text-muted-foreground">
            {(failureCount ?? 0) > 0
              ? `Retrying connection… (attempt ${(failureCount ?? 0) + 1})`
              : "Verifying your identity and permissions"}
          </p>
        </div>
      </div>
    );
  }

  if (notProvisioned) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <UserX className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">No Account Found</h3>
            {user?.profile?.email && (
              <div className="mt-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-2.5 text-xs text-muted-foreground border border-zinc-200/80 dark:border-zinc-700/60">
                Authenticated as: <span className="font-semibold text-foreground">{user.profile.email}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              You're signed in, but there's no matching user in this workspace yet.
              If you were invited, switch account and sign in with the exact email address that received the invitation (a different email, for example one from another sign-in provider, won't match). Otherwise ask your administrator to invite you.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Button size="sm" onClick={() => refetch()} className="gap-2 rounded-xl w-full sm:w-auto">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2 rounded-xl w-full sm:w-auto">
              <LogOut className="h-3.5 w-3.5" />
              Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !me) {
    // Distinguish between a true server-down (fetch-level failure) and an unexpected HTTP error
    const isNetworkError = error && !(error as any).status;
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="max-w-md w-full space-y-5 text-center p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            {isNetworkError
              ? <WifiOff className="h-7 w-7 text-red-500" />
              : <ServerCrash className="h-7 w-7 text-red-500" />
            }
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {isNetworkError ? "Cannot reach server" : "Workspace error"}
            </h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {isNetworkError
                ? "Unable to connect to the backend. Please check your internet connection or try again in a moment."
                : "An unexpected error occurred while loading your workspace. Our team has been notified."
              }
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <Button size="sm" onClick={() => refetch()} className="gap-2 rounded-xl w-full sm:w-auto">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Connection
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2 rounded-xl w-full sm:w-auto">
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (me.isPlatformContext) {
    if (me.tenantId) {
      return <Navigate to="/admin/org" replace />;
    }
    if (me.availableTenants && me.availableTenants.length > 0) {
      const defaultTenantId = me.availableTenants[0].id;
      if (typeof window !== "undefined") {
        localStorage.setItem("saas_erp_active_tenant_id", defaultTenantId);
      }
      return <Navigate to="/admin/org" replace />;
    }
    return <Navigate to="/platform/tenants" replace />;
  }

  const roleNames = (me.roles ?? []).map((r) => r.toLowerCase());
  const hasPerm = (p: string) => me.permissionKeys.includes(p);

  // 1. Owner: Tenant Owners / Directors with org administration rights land on Organisation
  const isOwner =
    hasPerm("admin.org.write") ||
    roleNames.some((r) => r.includes("owner") || r.includes("founder") || r.includes("director"));
  if (isOwner) {
    return <Navigate to="/admin/org" replace />;
  }

  // 2. Admin: System administrators land on Departments
  const isAdmin =
    roleNames.some((r) => r.includes("admin") && !r.includes("hr")) ||
    hasPerm("admin.department.write") ||
    hasPerm("admin.user.read") ||
    hasPerm("admin.role.read");
  if (isAdmin) {
    return <Navigate to="/admin/departments" replace />;
  }

  // 3. HR: HR specialists & managers land on Person Master (People)
  const isHR =
    roleNames.some((r) => r.includes("hr")) ||
    (hasPerm("hr.person.read") && hasPerm("hr.person.write"));
  if (isHR || hasPerm("hr.person.read")) {
    return <Navigate to="/hr/people" replace />;
  }

  // 4. Normal user (e.g. Nirmal, employee/volunteer) lands on Attendance Portal
  if (hasPerm("hr.attendance.read")) {
    return <Navigate to="/hr/attendance" replace />;
  }

  // Default Employee Self-Service fallback
  return <Navigate to="/payroll/my-payslips" replace />;
}
