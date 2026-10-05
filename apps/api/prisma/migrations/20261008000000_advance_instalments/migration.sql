-- Salary advance interest + repayment schedule
ALTER TABLE "salary_advances" ADD COLUMN IF NOT EXISTS "interest_rate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "salary_advances" ADD COLUMN IF NOT EXISTS "total_interest" DOUBLE PRECISION NOT NULL DEFAULT 0;

DO $$ BEGIN CREATE TYPE "AdvanceInstalmentStatus" AS ENUM ('SCHEDULED', 'PAID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "advance_instalments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "advance_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "due_year" INTEGER NOT NULL,
    "due_month" INTEGER NOT NULL,
    "principal" DOUBLE PRECISION NOT NULL,
    "interest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emi" DOUBLE PRECISION NOT NULL,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "AdvanceInstalmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paid_at" TIMESTAMP(3),
    CONSTRAINT "advance_instalments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "advance_instalments_advance_id_number_key" ON "advance_instalments"("advance_id", "number");
CREATE INDEX IF NOT EXISTS "advance_instalments_tenant_id_due_year_due_month_status_idx" ON "advance_instalments"("tenant_id", "due_year", "due_month", "status");

DO $$ BEGIN ALTER TABLE "advance_instalments" ADD CONSTRAINT "advance_instalments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "advance_instalments" ADD CONSTRAINT "advance_instalments_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "salary_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Row-Level Security
GRANT SELECT, INSERT, UPDATE, DELETE ON advance_instalments TO app_runtime;
ALTER TABLE advance_instalments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS advance_instalments_tenant_isolation ON advance_instalments;
CREATE POLICY advance_instalments_tenant_isolation ON advance_instalments
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Backfill: give existing open (interest-free) advances a schedule for what is still unrecovered,
-- starting next month. Already-recovered amount is recorded as paid instalments first.
INSERT INTO advance_instalments (id, tenant_id, advance_id, number, due_year, due_month, principal, interest, emi, balance_after, paid_amount, status)
SELECT gen_random_uuid()::text, a.tenant_id, a.id, g.n,
       EXTRACT(YEAR FROM (date_trunc('month', now()) + (g.n - a.done_n) * interval '1 month'))::int,
       EXTRACT(MONTH FROM (date_trunc('month', now()) + (g.n - a.done_n) * interval '1 month'))::int,
       LEAST(a.md, a.total - a.md * (g.n - 1)),
       0,
       LEAST(a.md, a.total - a.md * (g.n - 1)),
       GREATEST(0, a.total - a.md * g.n),
       CASE WHEN g.n <= a.done_n THEN LEAST(a.md, a.total - a.md * (g.n - 1)) ELSE 0 END,
       CASE WHEN g.n <= a.done_n THEN 'PAID'::"AdvanceInstalmentStatus" ELSE 'SCHEDULED'::"AdvanceInstalmentStatus" END
FROM (
  SELECT id, tenant_id,
         COALESCE(amount_approved, amount_requested) AS total,
         monthly_deduction AS md,
         FLOOR(amount_recovered / monthly_deduction)::int AS done_n,
         CEIL(COALESCE(amount_approved, amount_requested) / monthly_deduction)::int AS n_total
  FROM salary_advances
  WHERE status IN ('APPROVED', 'RECOVERING') AND monthly_deduction > 0
) a
CROSS JOIN LATERAL generate_series(1, a.n_total) AS g(n)
ON CONFLICT DO NOTHING;
