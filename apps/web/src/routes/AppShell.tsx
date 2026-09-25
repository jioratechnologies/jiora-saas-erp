import { NavLink, Outlet } from "react-router-dom";
import { Building2, Network, IdCard, ShieldCheck, Users, LogOut, Building } from "lucide-react";
import { useAuthStore } from "../auth/auth-store";
import { useMe } from "../auth/use-me";
import { Avatar } from "../components/ui/avatar";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/admin/org", label: "Organisation", icon: Building2 },
  { to: "/admin/departments", label: "Departments", icon: Network },
  { to: "/admin/designations", label: "Designations", icon: IdCard },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck },
  { to: "/admin/users", label: "Users", icon: Users },
];

/**
 * Shared shell for both panels. Nav sections are gated by isPlatformContext
 * — a platform user (tenantId null) has no tenant Admin permissions and
 * every /admin/* link would just 403 for them, and vice versa for a tenant
 * user against /platform/*.
 */
export function AppShell() {
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const { data: me } = useMe();

  const displayName = (user?.profile.name as string | undefined) ?? user?.profile.email ?? "Account";

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            S
          </span>
          <span className="text-sm font-semibold tracking-tight">saas-erp</span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {!me?.isPlatformContext &&
            navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          {me?.isPlatformContext && (
            <NavLink
              to="/platform/tenants"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Building className="h-4 w-4" />
              Tenants
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
          <Avatar name={displayName} size="sm" isBordered status="online" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight">{displayName}</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{me?.isPlatformContext ? "Platform" : "Tenant admin"}</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
