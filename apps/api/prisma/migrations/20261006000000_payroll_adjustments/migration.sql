-- CreateEnum
DO $$ BEGIN CREATE TYPE "PayrollAdjustmentType" AS ENUM ('BONUS', 'ALLOWANCE', 'DEDUCTION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_adjustments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "type" "PayrollAdjustmentType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

-- Payslip calculation summary (paid/unpaid days, per-day rate) for the voucher
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "calc_summary" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_adjustments_tenant_id_year_month_idx" ON "payroll_adjustments"("tenant_id", "year", "month");
CREATE INDEX IF NOT EXISTS "payroll_adjustments_tenant_id_person_id_year_month_idx" ON "payroll_adjustments"("tenant_id", "person_id", "year", "month");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Row-Level Security
GRANT SELECT, INSERT, UPDATE, DELETE ON payroll_adjustments TO app_runtime;

ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_adjustments_tenant_isolation ON payroll_adjustments;
CREATE POLICY payroll_adjustments_tenant_isolation ON payroll_adjustments
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
