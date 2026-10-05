import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  Download,
  Eye,
  Calendar,
  Building,
  CreditCard,
  CheckCircle,
  Clock,
  Sparkles,
  FileText,
} from "lucide-react";
import { api } from "../../api/client";
import { useMe } from "../../auth/use-me";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { SalaryVoucherDialog, type PayslipDetail } from "../../components/payroll/SalaryVoucher";
import { QueryState } from "../../components/query-state";
import { toast } from "../../components/ui/toast";
import { PageHeader } from "../../components/page-header";
import { Pagination } from "../../components/ui/pagination";
import { Skeleton } from "../../components/ui/skeleton";
import { usePagedQuery } from "../../lib/use-paged-query";

interface Payslip {
  id: string;
  year: number;
  month: number;
  totalWorkingDays: number;
  presentDays: number;
  lopDays: number;
  earnings?: Array<{ code: string; name: string; amount: number }>;
  deductions?: Array<{ code: string; name: string; amount: number }>;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paymentStatus: "PENDING" | "PAID";
  paymentReference?: string;
  createdAt: string;
  payrollRun: {
    title: string;
    status: string;
  };
}

interface DetailedPayslip extends Payslip {
  earnings: Array<{ code: string; name: string; amount: number }>;
  deductions: Array<{ code: string; name: string; amount: number }>;
  person: {
    id: string;
    firstName: string; middleName?: string | null;
    lastName: string;
    email: string;
    panNumber?: string;
    bankAccount?: string;
    bankIfsc?: string;
    department?: { name: string };
    designation?: { name: string };
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PayslipRow = memo(function PayslipRow({ p, onView }: { p: Payslip; onView: (id: string) => void }) {
  const statusVariant = p.paymentStatus === "PAID" ? "success" : "secondary";
  return (
    <tr className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2 px-3.5">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {MONTH_NAMES[p.month - 1]} {p.year}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{p.payrollRun.title}</div>
                        </td>
                        <td className="py-2 px-3 text-center font-medium text-foreground">
                          {p.totalWorkingDays} Days
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-semibold text-foreground">{p.presentDays}</span>
                          {p.lopDays > 0 ? (
                            <span className="ml-1 text-rose-600 font-bold">({p.lopDays} LOP)</span>
                          ) : (
                            <span className="ml-1 text-emerald-600 font-medium">(0 LOP)</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-muted-foreground">
                          ₹{p.grossPay.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                          -₹{p.totalDeductions.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3.5 text-right font-bold text-foreground">
                          ₹{p.netPay.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant={statusVariant} size="sm">{p.paymentStatus}</Badge>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onView(p.id)}
                            className="h-6.5 text-[11px] px-2 gap-1 rounded-lg"
                          >
                            <Eye className="h-3 w-3" />
                            <span>View Slip</span>
                          </Button>
                        </td>
                      </tr>
  );
});

interface PayslipsPaged {
  items: Payslip[];
  total: number;
  stats?: {
    count: number;
    latestNet: number | null;
    latestPeriod: { year: number; month: number } | null;
    ytdNet: number;
  };
}

export function MyPayslipsPage() {
  const { data: me } = useMe();
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);

  // Queries
  const payslipsQuery = usePagedQuery<Payslip, PayslipsPaged>({
    key: ["payroll", "runs", "my-payslips"],
    path: "/payroll/runs/my-payslips",
    pageSize: 10,
  });
  const paginatedPayslips = payslipsQuery.items;
  const isLoading = payslipsQuery.isLoading;
  const error = payslipsQuery.error;
  const totalItems = payslipsQuery.total;
  const stats = payslipsQuery.data?.stats;
  const latest = payslipsQuery.page === 1 ? paginatedPayslips[0] : undefined;

  const { data: detailedPayslip, isLoading: loadingDetail } = useQuery({
    queryKey: ["payroll", "payslips", "detail", selectedPayslipId],
    queryFn: () => api.get<DetailedPayslip>(`/payroll/runs/payslips/${selectedPayslipId}`),
    enabled: !!selectedPayslipId,
  });

  const orgQ = useQuery({
    queryKey: ["org", "theme"],
    queryFn: () => api.get<{ name: string; logoUrl: string | null }>("/admin/org"),
  });

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6 w-full">
      {/* Sticky Enterprise Header */}
      <PageHeader
        title="My Payslips & Compensation"
        description="View and download your monthly salary slips, itemized earnings, and statutory deductions."
        icon={Receipt}
        badge={{ label: `${totalItems} Statements`, variant: "secondary" }}
        stats={[
          { label: "Available Slips", value: totalItems },
          {
            label: "Latest Disbursed Net",
            value:
              stats?.latestNet != null
                ? `₹${Number(stats.latestNet).toLocaleString("en-IN")}`
                : "—",
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Year-to-Date Net",
            value: stats ? `₹${Number(stats.ytdNet).toLocaleString("en-IN")}` : "—",
            color: "text-primary",
          },
          {
            label: "Payment Status",
            value: latest ? latest.paymentStatus : "N/A",
            color:
              latest?.paymentStatus === "PAID"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400",
          },
        ]}
      />

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
        Expense claims and salary advances are paid separately and are <b className="text-foreground">not part of your salary slip</b>. Get their receipts from{" "}
        <Link to="/payroll/claims" className="font-semibold text-primary hover:underline">
          Claims &amp; Advances
        </Link>
        .
      </div>

      {/* Payslips Container */}
      <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <CardHeader className="py-2.5 px-4 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs sm:text-sm font-semibold">Salary Slips History</CardTitle>
            <CardDescription className="text-[11px] sm:text-xs">
              Official monthly pay records generated per payroll cycle.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono shrink-0">
            {totalItems} Records
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState isLoading={false} error={error}>
            {/* Mobile Native Card View */}
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 sm:hidden">
              {isLoading ? (
                <div className="p-3.5 space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : paginatedPayslips.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No salary slips generated yet.
                </div>
              ) : (
                paginatedPayslips.map((p) => {
                  const statusVariant = p.paymentStatus === "PAID" ? "success" : "secondary";
                  return (
                    <div key={p.id} className="p-3.5 space-y-2.5 bg-background hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-xs text-foreground truncate">
                            {MONTH_NAMES[p.month - 1]} {p.year}
                          </span>
                        </div>
                        <Badge variant={statusVariant} size="sm" className="text-[10px]">
                          {p.paymentStatus}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground truncate">{p.payrollRun.title}</p>

                      <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 text-[11px]">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Net Pay</span>
                          <span className="font-bold text-foreground text-xs">₹{p.netPay.toLocaleString("en-IN")}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Gross / Ded</span>
                          <span className="text-muted-foreground font-mono">
                            ₹{p.grossPay.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Days (LOP)</span>
                          <span className="font-medium text-foreground">
                            {p.presentDays}d {p.lopDays > 0 ? <span className="text-rose-500 font-bold">({p.lopDays} LOP)</span> : "(0 LOP)"}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end pt-0.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPayslipId(p.id)}
                          className="h-7 text-xs px-3 gap-1.5 rounded-lg w-full"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View Salary Slip</span>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop High-Density Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="py-2.5 px-3.5 text-left font-semibold">Pay Period</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Working Days</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Days Paid / LOP</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Gross Pay</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Total Deductions</th>
                    <th className="py-2.5 px-3.5 text-right font-semibold">Net Salary</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Status</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
                  {isLoading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`sk-${i}`}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="py-3 px-3"><Skeleton className="h-4 w-full max-w-[100px]" /></td>
                      ))}
                    </tr>
                  ))}
                  {paginatedPayslips.map((p) => (
                    <PayslipRow key={p.id} p={p} onView={setSelectedPayslipId} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              currentPage={payslipsQuery.page}
              totalPages={payslipsQuery.totalPages}
              totalItems={totalItems}
              pageSize={payslipsQuery.pageSize}
              onPageChange={payslipsQuery.setPage}
              onPageSizeChange={payslipsQuery.setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          </QueryState>
        </CardContent>
      </Card>

      <SalaryVoucherDialog
        isOpen={!!selectedPayslipId}
        onClose={() => setSelectedPayslipId(null)}
        payslip={detailedPayslip as PayslipDetail | undefined}
        loading={loadingDetail}
        org={{ name: orgQ.data?.name ?? "Organisation", logoUrl: orgQ.data?.logoUrl }}
      />
    </div>
  );
}
