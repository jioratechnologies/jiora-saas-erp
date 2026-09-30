import { Navigate } from "react-router-dom";
import { Loader2, UserX, RefreshCw, LogOut } from "lucide-react";
import { useMe } from "../auth/use-me";
import { useAuthStore } from "../auth/auth-store";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";

/**
 * "/" has no fixed destination — platform staff (super_admin/developer/
 * maintainer) land on the Super Admin panel, tenant users land on their
 * Organisation page. Decided by GET /auth/me, not guessed client-side.
 */
export function LandingRedirect() {
  const { data: me, isLoading, notProvisioned, error, refetch } = useMe();
  const signOut = useAuthStore((s) => s.signOut);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-foreground">Connecting to your workspace...</p>
        <p className="text-xs text-muted-foreground">Verifying permissions and environment</p>
      </div>
    );
  }

  if (notProvisioned) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
          <UserX className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">No Account Found</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You're signed in with Zitadel, but there's no matching user in saas-erp yet. Either you
            haven't been invited to a tenant, or (for platform staff) the platform role hasn't been
            bootstrapped for this account yet.
          </p>
          <Button variant="outline" onClick={signOut} className="gap-2 rounded-xl">
            <LogOut className="h-4 w-4" />
            Sign Out / Switch Account
          </Button>
        </div>
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4 text-center p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">SaaS ERP Server Unavailable</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Unable to reach the backend API server. Please ensure the server is active or check your internet connection.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button size="sm" onClick={() => refetch()} className="gap-2 rounded-xl">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Connection
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2 rounded-xl">
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
