import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Modal } from "../ui/modal";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { fullName } from "../../lib/input-constraints";
import { formatErrorMessage } from "../../lib/error-formatter";

interface Instalment {
  id: string;
  number: number;
  dueYear: number;
  dueMonth: number;
  principal: number;
  interest: number;
  emi: number;
  balanceAfter: number;
  paidAmount: number;
  status: "SCHEDULED" | "PAID";
}

export interface AdvanceLedgerData {
  id: string;
  reason: string;
  status: string;
  tenureMonths: number;
  interestRate: number;
  totalInterest: number;
  amountRecovered: number;
  principal: number;
  totalPayable: number;
  balance: number;
  person: { firstName: string; middleName?: string | null; lastName: string };
  instalments: Instalment[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Repayment ledger of one salary advance: terms, amount repaid, balance and every instalment. */
export function AdvanceLedgerModal({ advanceId, onClose }: { advanceId: string | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["payroll", "claims", "advance-ledger", advanceId],
    queryFn: () => api.get<AdvanceLedgerData>(`/payroll/claims/advances/${advanceId}/schedule`),
    enabled: !!advanceId,
  });
  const a = q.data;

  const tile = (label: string, value: string, cls = "") => (
    <div className="rounded-xl border border-border p-2.5">
      <span className="text-[10px] text-muted-foreground block">{label}</span>
      <b className={cls}>{value}</b>
    </div>
  );

  return (
    <Modal
      isOpen={!!advanceId}
      onClose={onClose}
      title="Advance repayment ledger"
      description={a ? `${fullName(a.person)} · ${a.reason}` : undefined}
      maxWidth="2xl"
    >
      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.error || !a ? (
        <p className="text-xs text-muted-foreground py-6 text-center">{formatErrorMessage(q.error)}</p>
      ) : (
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {tile("Advance amount", inr(a.principal))}
            {tile("Interest", a.interestRate > 0 ? `${a.interestRate}% p.a. · ${inr(a.totalInterest)}` : "Interest-free")}
            {tile("Repaid so far", inr(a.amountRecovered), "text-emerald-600 dark:text-emerald-400")}
            {tile("Balance to repay", inr(a.balance), a.balance > 0 ? "text-destructive" : "")}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground bg-muted/40">
                  <th className="py-2 px-3 text-left font-semibold">#</th>
                  <th className="py-2 px-3 text-left font-semibold">Month</th>
                  <th className="py-2 px-3 text-right font-semibold">Principal</th>
                  <th className="py-2 px-3 text-right font-semibold">Interest</th>
                  <th className="py-2 px-3 text-right font-semibold">EMI</th>
                  <th className="py-2 px-3 text-right font-semibold">Balance</th>
                  <th className="py-2 px-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {a.instalments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No repayment schedule yet.
                    </td>
                  </tr>
                ) : (
                  a.instalments.map((i) => (
                    <tr key={i.id}>
                      <td className="py-2 px-3">{i.number}</td>
                      <td className="py-2 px-3">
                        {MONTHS[i.dueMonth - 1]} {i.dueYear}
                      </td>
                      <td className="py-2 px-3 text-right">{inr(i.principal)}</td>
                      <td className="py-2 px-3 text-right">{inr(i.interest)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{inr(i.emi)}</td>
                      <td className="py-2 px-3 text-right">{inr(i.balanceAfter)}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={i.status === "PAID" ? "success" : "secondary"} size="sm">
                          {i.status === "PAID" ? "Deducted" : i.paidAmount > 0 ? "Part deducted" : "Upcoming"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Each instalment is deducted from the salary slip of its month and counted as repaid once that month's payroll is disbursed.
          </p>
        </div>
      )}
    </Modal>
  );
}
