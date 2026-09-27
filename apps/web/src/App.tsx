import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./auth/auth-store";
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
import { HolidaysPage } from "./routes/hr/HolidaysPage";
import { SalaryStructurePage } from "./routes/payroll/SalaryStructurePage";
import { PayrollRunsPage } from "./routes/payroll/PayrollRunsPage";
import { ClaimsPage } from "./routes/payroll/ClaimsPage";
import { MyPayslipsPage } from "./routes/payroll/MyPayslipsPage";

const queryClient = new QueryClient();

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
                <Route
                  path="/admin/departments"
                  element={<SimpleNamedListPage title="Departments" apiPath="/admin/departments" />}
                />
                <Route
                  path="/admin/designations"
                  element={<SimpleNamedListPage title="Designations" apiPath="/admin/designations" />}
                />
                <Route path="/admin/roles" element={<AdminRolesPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/hr/people" element={<PeoplePage />} />
                <Route path="/hr/attendance" element={<AttendancePage />} />
                <Route path="/hr/leave" element={<LeavePage />} />
                <Route path="/hr/holidays" element={<HolidaysPage />} />
                <Route path="/payroll/salary" element={<SalaryStructurePage />} />
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
