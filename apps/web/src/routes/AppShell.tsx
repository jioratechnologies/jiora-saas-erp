import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../auth/auth-store";
import { useMe } from "../auth/use-me";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-1.5 text-sm ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`;

/**
 * Shared shell for both panels. Nav sections are gated by isPlatformContext
 * — a platform user (tenantId null) has no tenant Admin permissions and
 * every /admin/* link would just 403 for them, and vice versa for a tenant
 * user against /platform/*.
 */
export function AppShell() {
  const signOut = useAuthStore((s) => s.signOut);
  const { data: me } = useMe();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border p-4">
        <p className="mb-4 px-3 text-sm font-semibold">saas-erp</p>
        <nav className="space-y-1">
          {!me?.isPlatformContext && (
            <>
              <NavLink to="/admin/org" className={navLinkClass}>
                Organisation
              </NavLink>
              <NavLink to="/admin/departments" className={navLinkClass}>
                Departments
              </NavLink>
              <NavLink to="/admin/designations" className={navLinkClass}>
                Designations
              </NavLink>
              <NavLink to="/admin/roles" className={navLinkClass}>
                Roles
              </NavLink>
              <NavLink to="/admin/users" className={navLinkClass}>
                Users
              </NavLink>
            </>
          )}
          {me?.isPlatformContext && (
            <NavLink to="/platform/tenants" className={navLinkClass}>
              Tenants
            </NavLink>
          )}
        </nav>
        <button onClick={signOut} className="mt-6 px-3 text-sm text-muted-foreground hover:underline">
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
