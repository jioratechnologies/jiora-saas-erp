import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./auth/auth-store";
import { ApiError } from "./api/client";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ConfirmProvider } from "./hooks/use-confirm";
import { ToastProvider, ToastBridge } from "./components/ui/toast";
import { RequireAuth } from "./routes/RequireAuth";
import { AppShell } from "./routes/AppShell";
import { CallbackPage } from "./routes/CallbackPage";
import { LandingRedirect } from "./routes/LandingRedirect";
import { AdminOrgPage } from "./routes/AdminOrgPage";
import { SimpleNamedListPage } from "./routes/SimpleNamedListPage";
import { AdminRolesPage } from "./routes/AdminRolesPage";
import { AdminUsersPage } from "./routes/AdminUsersPage";
import { PlatformTenantsPage } from "./routes/PlatformTenantsPage";
import { PeoplePage } from "./routes/hr/PeoplePage";
import { AttendancePage } from "./routes/hr/AttendancePage";
import { LeavePage } from "./routes/hr/LeavePage";
import { LeaveApprovalsPage } from "./routes/hr/LeaveApprovalsPage";
import { LeavePoliciesPage } from "./routes/hr/LeavePoliciesPage";
import { CompensationPage } from "./routes/payroll/CompensationPage";
import { PayrollRunsPage } from "./routes/payroll/PayrollRunsPage";
import { ClaimsPage } from "./routes/payroll/ClaimsPage";
import { MyPayslipsPage } from "./routes/payroll/MyPayslipsPage";
import { AdminDepartmentsPage } from "./routes/AdminDepartmentsPage";

// Client errors (401/403/404...) won't fix themselves on retry, so fail fast
// instead of hammering the API; only transient failures get one retry. Data is kept fresh for a
// minute so navigating back to a table does not refetch over the high-latency DB link.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 1;
      },
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  const loadUser = useAuthStore((s) => s.loadUser);
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <ToastBridge />
          <ConfirmProvider>
            <BrowserRouter>
            <Routes>
              <Route path="/callback" element={<CallbackPage />} />
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<LandingRedirect />} />
                <Route path="/admin/org" element={<AdminOrgPage />} />
                <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
                <Route path="/hr/departments" element={<Navigate to="/admin/departments" replace />} />
                <Route
                  path="/admin/designations"
                  element={<SimpleNamedListPage title="Designations" apiPath="/admin/designations" />}
                />
                <Route path="/admin/roles" element={<AdminRolesPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/hr/people" element={<PeoplePage />} />
                <Route path="/hr/attendance" element={<AttendancePage />} />
                <Route path="/hr/leave" element={<LeavePage />} />
                <Route path="/hr/leave/approvals" element={<LeaveApprovalsPage />} />
                <Route path="/hr/leave/policies" element={<LeavePoliciesPage />} />
                <Route path="/hr/holidays" element={<Navigate to="/hr/leave/policies" replace />} />
                <Route path="/payroll/salary" element={<CompensationPage />} />
                <Route path="/payroll/runs" element={<PayrollRunsPage />} />
                <Route path="/payroll/claims" element={<ClaimsPage />} />
                <Route path="/payroll/my-payslips" element={<MyPayslipsPage />} />
                <Route path="/platform/tenants" element={<PlatformTenantsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
}
