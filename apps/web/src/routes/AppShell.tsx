import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@saas-erp/shared-types";
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
  ChevronDown,
  Sun,
  Moon,
  Laptop,
  Menu,
  X as CloseIcon,
  Clock,
  PlaneTakeoff,
  CalendarDays,
  UserCheck,
  UserCog,
  Banknote,
  FileSpreadsheet,
  CreditCard,
  Receipt,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  CloudOff,
  RefreshCw,
  UserX,
  Loader2,
} from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../auth/auth-store";
import { useMe } from "../auth/use-me";
import { Avatar } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { useTheme } from "../theme/ThemeProvider";
import { EditProfileModal } from "../components/profile/EditProfileModal";
import { GlobalSearch } from "../components/global-search";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  permission?: string;
  section: "hr" | "admin" | "payroll";
  /** Expandable group: children are shown only when the user holds their permission. */
  children?: NavChild[];
}

interface NavChild {
  to: string;
  label: string;
  icon: any;
  permission?: string;
  /** Exact path match, so "/hr/leave" is not active on "/hr/leave/approvals". */
  end?: boolean;
}

const navItems: NavItem[] = [
  // HR Core Module
  { to: "/hr/people", label: "People", icon: Users, permission: "hr.person.read", section: "hr" },
  {
    to: "/hr/attendance",
    label: "Attendance & Leave",
    icon: Clock,
    section: "hr",
    children: [
      { to: "/hr/attendance", label: "Attendance", icon: Clock, permission: "hr.attendance.read", end: true },
      { to: "/hr/leave", label: "My Leaves", icon: PlaneTakeoff, permission: "hr.leave.read", end: true },
      { to: "/hr/leave/approvals", label: "Leave Approvals", icon: UserCheck, permission: "hr.leave.approve", end: true },
      { to: "/hr/leave/policies", label: "Leave Policies & Holidays", icon: CalendarDays, permission: "hr.holiday.read", end: true },
    ],
  },

  // Payroll & Claims Module (Phase 3)
  { to: "/payroll/salary", label: "Compensation", icon: Banknote, permission: "payroll.salary.read", section: "payroll" },
  { to: "/payroll/runs", label: "Payroll Runs", icon: FileSpreadsheet, permission: "payroll.run.read", section: "payroll" },
  { to: "/payroll/claims", label: "Claims & Advances", icon: CreditCard, section: "payroll" },
  { to: "/payroll/my-payslips", label: "My Payslips", icon: Receipt, section: "payroll" },

  // Admin Module
  { to: "/admin/org", label: "Organisation", icon: Building2, permission: "admin.org.read", section: "admin" },
  { to: "/admin/departments", label: "Departments", icon: Network, permission: "admin.department.read", section: "admin" },
  { to: "/admin/designations", label: "Designations", icon: IdCard, permission: "admin.designation.read", section: "admin" },
  { to: "/admin/roles", label: "Access Control", icon: ShieldCheck, permission: "admin.role.read", section: "admin" },
  { to: "/admin/users", label: "Users", icon: UserCheck, permission: "admin.user.read", section: "admin" },
];

/** Expandable sidebar group; flyout list when the sidebar is collapsed to icons. */
function NavGroup({
  label,
  icon: Icon,
  items,
  collapsed,
  pathname,
  onNavigate,
}: {
  label: string;
  icon: any;
  items: NavChild[];
  collapsed: boolean;
  pathname: string;
  onNavigate: () => void;
}) {
  const childActive = items.some((c) => pathname === c.to || pathname.startsWith(c.to + "/"));
  const [open, setOpen] = useState(childActive);

  // Auto-expand when navigating (e.g. via global search or a redirect) into a child route.
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-xl text-sm font-medium transition-all duration-150 px-3 py-2",
      isActive
        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-semibold"
        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900",
    );

  if (collapsed) {
    return (
      <div className="group relative">
        <button
          type="button"
          title={label}
          aria-label={label}
          aria-haspopup="menu"
          className={cn(
            "flex h-11 w-11 mx-auto items-center justify-center rounded-xl transition-all duration-150 cursor-pointer",
            childActive
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900",
          )}
        >
          <Icon className="h-5 w-5 shrink-0" />
        </button>
        <div
          role="menu"
          className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-full top-0 z-50 pl-2"
        >
          <div className="w-60 space-y-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 shadow-xl">
            <p className="px-3 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {label}
            </p>
            {items.map(({ to, label: l, icon: CIcon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={onNavigate} className={linkClass}>
                <CIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{l}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer",
          childActive && !open
            ? "bg-primary/10 text-primary font-semibold"
            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1 ml-4 space-y-1 border-l border-zinc-200 dark:border-zinc-800 pl-2">
          {items.map(({ to, label: l, icon: CIcon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onNavigate} className={linkClass}>
              <CIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{l}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shared shell with collapsible sidebar (icon-only when collapsed),
 * Dark / Light theme switcher, and modern rounded aesthetics.
 */
export function AppShell() {
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const { data: me, isLoading: isMeLoading, error: meError, notProvisioned, refetch: refetchMe } = useMe();
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("saas_erp_sidebar_collapsed") === "true";
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  // Tenant branding — platform staff have no tenant (isPlatformContext),
  // so this never fires for them; GET /admin/org has nothing meaningful to
  // return without a tenantId.
  const { data: org } = useQuery({
    queryKey: ["org", "theme"],
    queryFn: () => api.get<Tenant>("/admin/org"),
    enabled: Boolean(user) && me?.isPlatformContext === false,
    staleTime: 60 * 1000,
  });

  // User profile
  const { data: profileData } = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: () => api.get<any>("/auth/profile"),
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("saas_erp_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  const displayName =
    profileData?.user?.displayName ||
    (user?.profile.name as string | undefined) ||
    user?.profile.email ||
    "Account";

  const userRoleLabel = me?.isPlatformContext
    ? "Platform Admin"
    : me?.roles && me.roles.length > 0
      ? me.roles.join(", ")
      : "Tenant Member";

  const avatarUrl = profileData?.user?.avatarUrl || profileData?.person?.avatarUrl;
  const orgName = org?.name || "saas-erp";
  const orgLogo = org?.logoUrl || undefined;
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [orgLogo]);

  const showLogo = Boolean(orgLogo && !logoError);

  const can = (permission?: string) => !permission || Boolean(me?.permissionKeys?.includes(permission));
  const visibleNav = navItems
    .map((item) => (item.children ? { ...item, children: item.children.filter((c) => can(c.permission)) } : item))
    .filter((item) => (item.children ? item.children.length > 0 : can(item.permission)));
  const hrNavItems = visibleNav.filter((item) => item.section === "hr");
  const payrollNavItems = visibleNav.filter((item) => item.section === "payroll");
  const adminNavItems = visibleNav.filter((item) => item.section === "admin");
  const hasNavItems = hrNavItems.length > 0 || payrollNavItems.length > 0 || adminNavItems.length > 0;

  if (isMeLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950 text-foreground">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-bold text-xl">
          {orgName.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mt-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading workspace...</span>
        </div>
        <p className="text-xs text-muted-foreground">Connecting to SaaS ERP services</p>
      </div>
    );
  }

  if (notProvisioned) {
    return (
      <div className="flex h-screen w-screen items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <UserX className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No Account Found</h3>
          
          {user?.profile?.email && (
            <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-2.5 text-xs text-muted-foreground border border-zinc-200/80 dark:border-zinc-700/60">
              Authenticated identity: <span className="font-semibold text-foreground">{user.profile.email}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">
            You are signed in with Zitadel, but this email has not been provisioned as an active user in SaaS ERP. Please switch to an authorized workspace account or ask your administrator to invite you.
          </p>
          <Button variant="outline" onClick={signOut} className="gap-2 rounded-xl w-full justify-center">
            <LogOut className="h-4 w-4" />
            <span>Sign Out / Switch Account</span>
          </Button>
        </div>
      </div>
    );
  }

  if (meError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md w-full text-center space-y-4 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <CloudOff className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">SaaS ERP Server Unavailable</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Unable to reach the backend API server. Please ensure the server is active or check your network connection.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button onClick={() => refetchMe()} size="sm" className="gap-2 rounded-xl">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Connection</span>
            </Button>
            <Button onClick={signOut} variant="outline" size="sm" className="gap-2 rounded-xl">
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground transition-colors duration-200 flex-col md:flex-row">
      {/* Mobile Top Header (visible on small/collapsed screens) */}
      <header className="md:hidden flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0 z-40">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title={mobileOpen ? "Close menu" : "Open menu"}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          {showLogo ? (
            <img
              src={orgLogo}
              alt={orgName}
              onError={() => setLogoError(true)}
              className="h-7 w-7 rounded-lg object-contain border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-sm">
              {orgName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-base font-bold tracking-tight text-foreground truncate">{orgName}</span>
        </div>

        {/* Mobile Header Right Actions: Search Button & User Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-foreground transition-colors cursor-pointer"
            title="Search people & modules"
            aria-label="Open search"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => setEditProfileOpen(true)}
            className="flex items-center rounded-xl overflow-hidden cursor-pointer"
            title="View my profile"
          >
            <Avatar name={displayName} src={avatarUrl || undefined} size="sm" className="h-7 w-7 text-xs" />
          </button>
        </div>
      </header>

      {/* Mobile Search Modal */}
      {mobileSearchOpen && (
        <GlobalSearch isMobileModal onClose={() => setMobileSearchOpen(false)} />
      )}

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
          "h-dvh shrink-0 flex flex-col border-r border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-950 transition-all duration-300 ease-in-out select-none",
          // Desktop styles
          "hidden md:sticky md:top-0 md:flex md:z-40",
          collapsed ? "md:w-[72px]" : "md:w-64",
          // Mobile drawer styles
          mobileOpen && "!flex fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl h-[100dvh] max-h-[100dvh]",
        )}
      >
        {/* Floating border toggle button (prominent, easy to identify & click) */}
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex absolute -right-4 top-4.5 z-50 h-8 w-8 items-center justify-center rounded-xl border border-zinc-200/90 dark:border-zinc-700/90 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 shadow-md hover:shadow-lg hover:border-primary/60 hover:text-primary dark:hover:text-primary active:scale-95 transition-all cursor-pointer"
          title={collapsed ? "Expand sidebar (Panel)" : "Collapse sidebar (Panel)"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4.5 w-4.5" />
          ) : (
            <PanelLeftClose className="h-4.5 w-4.5" />
          )}
        </button>

        {/* Header / Brand */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2.5 py-4 border-b border-zinc-100 dark:border-zinc-900">
            <button
              onClick={toggleCollapsed}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              title={`Expand sidebar (${orgName})`}
              aria-label="Expand sidebar"
            >
              {showLogo ? (
                <img
                  src={orgLogo}
                  alt={orgName}
                  onError={() => setLogoError(true)}
                  className="h-9 w-9 rounded-xl object-contain border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25">
                  {orgName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-100 dark:border-zinc-900">
            <div className="flex items-center gap-2.5 min-w-0">
              {showLogo ? (
                <img
                  src={orgLogo}
                  alt={orgName}
                  onError={() => setLogoError(true)}
                  className="h-8 w-8 shrink-0 rounded-xl object-contain border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25">
                  {orgName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate text-base font-bold tracking-tight text-foreground" title={orgName}>
                {orgName}
              </span>
            </div>

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
          {!me?.isPlatformContext && (
            <>
              {/* HR Core Section */}
              {hrNavItems.length > 0 && (
                <div className="space-y-1">
                  {!collapsed && (
                    <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      HR Core
                    </p>
                  )}
                  {hrNavItems.map(({ to, label, icon: Icon, children }) =>
                    children ? (
                      <NavGroup
                        key={to}
                        label={label}
                        icon={Icon}
                        items={children}
                        collapsed={collapsed}
                        pathname={location.pathname}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    ) : (
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
                    ),
                  )}
                </div>
              )}

              {/* Section Divider */}
              {hrNavItems.length > 0 && (payrollNavItems.length > 0 || adminNavItems.length > 0) && (
                <div className={cn(collapsed ? "my-2 border-t border-zinc-200 dark:border-zinc-800 mx-2" : "pt-2")} />
              )}

              {/* Payroll & Claims Section */}
              {payrollNavItems.length > 0 && (
                <div className="space-y-1">
                  {!collapsed && (
                    <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      Payroll & Claims
                    </p>
                  )}
                  {payrollNavItems.map(({ to, label, icon: Icon }) => (
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
                </div>
              )}

              {/* Section Divider */}
              {payrollNavItems.length > 0 && adminNavItems.length > 0 && (
                <div className={cn(collapsed ? "my-2 border-t border-zinc-200 dark:border-zinc-800 mx-2" : "pt-2")} />
              )}

              {/* Administration Section */}
              {adminNavItems.length > 0 && (
                <div className="space-y-1">
                  {!collapsed && (
                    <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      Administration
                    </p>
                  )}
                  {adminNavItems.map(({ to, label, icon: Icon }) => (
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
                </div>
              )}

              {!hasNavItems && !collapsed && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No modules assigned to your role.
                </div>
              )}
            </>
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
        <div className="px-3 pb-2 shrink-0">
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
          <div className="flex items-center gap-2.5 border-t border-zinc-100 dark:border-zinc-900 px-3 py-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setEditProfileOpen(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 p-1 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-left cursor-pointer group"
              title="Click to view and edit your profile & KYC"
            >
              <Avatar
                name={displayName}
                src={avatarUrl || undefined}
                size="sm"
                isBordered
                status="online"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-xs font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
                    {displayName}
                  </p>
                  <UserCog className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate" title={userRoleLabel}>
                  {userRoleLabel}
                </p>
              </div>
            </button>
            <button
              onClick={signOut}
              title="Sign out"
              className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 border-t border-zinc-100 dark:border-zinc-900 py-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => setEditProfileOpen(true)}
              title="My Account & KYC Profile"
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
            >
              <Avatar name={displayName} src={avatarUrl || undefined} size="sm" isBordered status="online" />
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
      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-y-auto bg-zinc-50/70 dark:bg-zinc-950">
        {/* Sticky Desktop Top Header Bar */}
        <header className="hidden md:flex sticky top-0 z-30 h-14 shrink-0 items-center justify-between px-6 lg:px-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <span className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                {showLogo ? (
                  <img
                    src={orgLogo}
                    alt={orgName}
                    onError={() => setLogoError(true)}
                    className="h-4 w-4 rounded-md object-contain"
                  />
                ) : (
                  <span className="h-4 w-4 rounded-md bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                    {orgName.slice(0, 1)}
                  </span>
                )}
                {orgName}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="truncate capitalize font-medium text-foreground">
                {location.pathname.replace(/^\//, "").replace(/\//g, " › ") || "Dashboard"}
              </span>
            </div>
          </div>

          {/* Global Search Box */}
          <GlobalSearch />

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Dynamic Page Action Portal (Primary Page Actions) */}
            <div id="appshell-header-actions" className="hidden lg:flex items-center gap-2" />

            {/* User Profile Pill */}
            <button
              type="button"
              onClick={() => setEditProfileOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-primary/40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer group"
              title="View & edit my profile"
            >
              <Avatar name={displayName} src={avatarUrl || undefined} size="sm" className="h-6 w-6 text-xs" />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-tight truncate max-w-[120px]">
                  {displayName}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Fluid Responsive Content Container (Wide Screen Optimized) */}
        <div className="flex-1 w-full max-w-[1720px] mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-4 md:py-6">
          <Outlet />
        </div>
      </main>

      {/* Account & KYC Edit Profile Modal */}
      <EditProfileModal isOpen={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
    </div>
  );
}
