import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Building2,
  Network,
  IdCard,
  ShieldCheck,
  Users,
  LogOut,
  Building,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Laptop,
  Menu,
  X as CloseIcon,
} from "lucide-react";
import { useAuthStore } from "../auth/auth-store";
import { useMe } from "../auth/use-me";
import { Avatar } from "../components/ui/avatar";
import { useTheme } from "../theme/ThemeProvider";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  permission?: string;
}

const navItems: NavItem[] = [
  { to: "/admin/org", label: "Organisation", icon: Building2, permission: "admin.org.read" },
  { to: "/admin/departments", label: "Departments", icon: Network, permission: "admin.department.read" },
  { to: "/admin/designations", label: "Designations", icon: IdCard, permission: "admin.designation.read" },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck, permission: "admin.role.read" },
  { to: "/admin/users", label: "Users", icon: Users, permission: "admin.user.read" },
];

/**
 * Shared shell with collapsible sidebar (icon-only when collapsed),
 * Dark / Light theme switcher, and HeroUI aesthetics.
 */
export function AppShell() {
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("saas_erp_sidebar_collapsed") === "true";
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("saas_erp_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  const displayName = (user?.profile.name as string | undefined) ?? user?.profile.email ?? "Account";
  const userRoleLabel = me?.isPlatformContext
    ? "Platform Admin"
    : me?.roles && me.roles.length > 0
    ? me.roles.join(", ")
    : "Tenant Member";

  const allowedNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return me?.permissionKeys?.includes(item.permission);
  });

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-200 flex-col md:flex-row">
      {/* Mobile Top Header (visible on small/collapsed screens) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title={mobileOpen ? "Close menu" : "Open menu"}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-sm">
            S
          </span>
          <span className="text-base font-bold tracking-tight text-foreground">saas-erp</span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title={`Theme: ${resolvedTheme}`}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
        </button>
      </header>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "h-screen shrink-0 flex flex-col border-r border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-950 transition-all duration-300 ease-in-out select-none",
          // Desktop styles
          "hidden md:sticky md:top-0 md:flex md:z-30",
          collapsed ? "md:w-[72px]" : "md:w-64",
          // Mobile drawer styles
          mobileOpen && "!flex fixed inset-y-0 left-0 z-50 w-64 shadow-2xl",
        )}
      >
        {/* Floating border toggle button (always visible & clickable on desktop) */}
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex absolute -right-3.5 top-5 z-40 h-7 w-7 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-foreground shadow-md hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white hover:border-primary active:scale-95 transition-all cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {/* Header / Brand */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2.5 py-4 border-b border-zinc-100 dark:border-zinc-900">
            <button
              onClick={toggleCollapsed}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              title="Click to expand sidebar"
              aria-label="Expand sidebar"
            >
              S
            </button>
            <button
              onClick={toggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all cursor-pointer group shadow-xs"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-100 dark:border-zinc-900">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25">
                S
              </span>
              <span className="truncate text-base font-bold tracking-tight text-foreground">
                saas-erp
              </span>
            </div>
            <button
              onClick={toggleCollapsed}
              className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Close menu"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation items */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
          {!me?.isPlatformContext &&
            allowedNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center rounded-xl font-medium text-sm transition-all duration-150",
                    collapsed
                      ? "h-11 w-11 mx-auto justify-center"
                      : "gap-3 px-3.5 py-2.5",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900",
                  )
                }
              >
                <Icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            ))}

          {!me?.isPlatformContext && allowedNavItems.length === 0 && !collapsed && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No admin modules assigned.
            </div>
          )}

          {me?.isPlatformContext && (
            <NavLink
              to="/platform/tenants"
              title={collapsed ? "Tenants" : undefined}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center rounded-xl font-medium text-sm transition-all duration-150",
                  collapsed
                    ? "h-11 w-11 mx-auto justify-center"
                    : "gap-3 px-3.5 py-2.5",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900",
                )
              }
            >
              <Building className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
              {!collapsed && <span className="truncate">Tenants</span>}
            </NavLink>
          )}
        </nav>

        {/* Theme Mode Switcher */}
        <div className="px-3 pb-2">
          {!collapsed ? (
            <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1 border border-zinc-200/50 dark:border-zinc-800/50">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  theme === "light"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Light mode"
              >
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  theme === "dark"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Dark mode"
              >
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  theme === "system"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Follow system preference"
              >
                <Laptop className="h-3.5 w-3.5" />
                <span>Auto</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-11 w-11 mx-auto items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              title={`Theme: ${resolvedTheme} (click to toggle)`}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-5 w-5 text-amber-400" />
              ) : (
                <Moon className="h-5 w-5 text-indigo-500" />
              )}
            </button>
          )}
        </div>

        {/* User Profile Footer */}
        {!collapsed ? (
          <div className="flex items-center gap-2.5 border-t border-zinc-100 dark:border-zinc-900 px-4 py-3.5">
            <Avatar name={displayName} size="sm" isBordered status="online" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold leading-tight text-foreground">{displayName}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate" title={userRoleLabel}>
                {userRoleLabel}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 border-t border-zinc-100 dark:border-zinc-900 py-3">
            <button
              onClick={toggleCollapsed}
              title="Click to expand sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
            >
              <Avatar name={displayName} size="sm" isBordered status="online" />
            </button>
            <button
              onClick={toggleCollapsed}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={signOut}
              title="Sign out"
              className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
