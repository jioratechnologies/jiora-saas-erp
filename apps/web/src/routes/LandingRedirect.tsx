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
              Ask your administrator to invite you, or switch to an authorized workspace account.
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
    return <Navigate to="/platform/tenants" replace />;
  }

  // Priority 1: Admin modules (Tenant owners and administrators land on Organisation)
  if (me.permissionKeys.includes("admin.org.read")) {
    return <Navigate to="/admin/org" replace />;
  }
  if (me.permissionKeys.includes("admin.user.read")) {
    return <Navigate to="/admin/users" replace />;
  }
  if (me.permissionKeys.includes("admin.department.read")) {
    return <Navigate to="/admin/departments" replace />;
  }

  // Priority 2: HR modules (HR specialists and managers land on Person Master)
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

  // Priority 3: Payroll & Claims modules
  if (me.permissionKeys.includes("payroll.salary.read")) {
    return <Navigate to="/payroll/salary" replace />;
  }
  if (me.permissionKeys.includes("payroll.run.read")) {
    return <Navigate to="/payroll/runs" replace />;
  }

  // Fallback Admin modules
  if (me.permissionKeys.includes("admin.designation.read")) {
    return <Navigate to="/admin/designations" replace />;
  }
  if (me.permissionKeys.includes("admin.role.read")) {
    return <Navigate to="/admin/roles" replace />;
  }

  // Default Employee Self-Service destination for all tenant members
  return <Navigate to="/payroll/my-payslips" replace />;
}
