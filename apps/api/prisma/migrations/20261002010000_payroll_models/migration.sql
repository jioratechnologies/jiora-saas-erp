-- Payroll / claims / advances tables. Some environments already have these
-- tables from an earlier `prisma db push`, so every statement is idempotent:
-- existing types, tables, indexes and constraints are left as they are.

-- CreateEnum
DO $$ BEGIN CREATE TYPE "SalaryComponentType" AS ENUM ('EARNING', 'DEDUCTION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'DISBURSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ExpenseClaimCategory" AS ENUM ('TRAVEL', 'LODGING', 'FOOD', 'SUPPLIES', 'COMMUNICATION', 'OFFICIAL_MEETING', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SETTLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "SalaryAdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RECOVERING', 'RECOVERED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "salary_components" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SalaryComponentType" NOT NULL DEFAULT 'EARNING',
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "is_statutory" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "salary_structures" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "items" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_salary_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "salary_structure_id" TEXT,
    "base_gross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custom_items" JSONB DEFAULT '[]',
    "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_mode" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "bank_account" TEXT,
    "bank_ifsc" TEXT,
    "pan_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_salary_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "total_gross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_net" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processed_staff_count" INTEGER NOT NULL DEFAULT 0,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "disbursed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payslips" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payroll_run_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "total_working_days" INTEGER NOT NULL DEFAULT 30,
    "present_days" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "lop_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "earnings" JSONB NOT NULL DEFAULT '[]',
    "deductions" JSONB NOT NULL DEFAULT '[]',
    "gross_pay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_pay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "expense_claims" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ExpenseClaimCategory" NOT NULL DEFAULT 'TRAVEL',
    "amount" DOUBLE PRECISION NOT NULL,
    "expense_date" DATE NOT NULL,
    "description" TEXT,
    "receipt_urls" JSONB DEFAULT '[]',
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approver_id" TEXT,
    "decision_notes" TEXT,
    "decided_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "settlement_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "salary_advances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "amount_requested" DOUBLE PRECISION NOT NULL,
    "amount_approved" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "tenure_months" INTEGER NOT NULL DEFAULT 1,
    "monthly_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_recovered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "SalaryAdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "approver_id" TEXT,
    "decision_notes" TEXT,
    "decided_at" TIMESTAMP(3),
    "disbursed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "salary_revisions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "old_gross" DOUBLE PRECISION,
    "new_gross" DOUBLE PRECISION NOT NULL,
    "old_designation_id" TEXT,
    "new_designation_id" TEXT,
    "effective_date" DATE NOT NULL,
    "remarks" TEXT,
    "promoted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salary_components_tenant_id_type_idx" ON "salary_components"("tenant_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "salary_components_tenant_id_code_key" ON "salary_components"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "salary_structures_tenant_id_name_key" ON "salary_structures"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "employee_salary_assignments_person_id_key" ON "employee_salary_assignments"("person_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_salary_assignments_tenant_id_salary_structure_id_idx" ON "employee_salary_assignments"("tenant_id", "salary_structure_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_runs_tenant_id_status_idx" ON "payroll_runs"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_runs_tenant_id_year_month_key" ON "payroll_runs"("tenant_id", "year", "month");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payslips_tenant_id_person_id_year_month_idx" ON "payslips"("tenant_id", "person_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payslips_tenant_id_payroll_run_id_person_id_key" ON "payslips"("tenant_id", "payroll_run_id", "person_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "expense_claims_tenant_id_person_id_status_idx" ON "expense_claims"("tenant_id", "person_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "expense_claims_tenant_id_approver_id_status_idx" ON "expense_claims"("tenant_id", "approver_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "expense_claims_tenant_id_status_idx" ON "expense_claims"("tenant_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salary_advances_tenant_id_person_id_status_idx" ON "salary_advances"("tenant_id", "person_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salary_advances_tenant_id_status_idx" ON "salary_advances"("tenant_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salary_revisions_tenant_id_person_id_effective_date_idx" ON "salary_revisions"("tenant_id", "person_id", "effective_date");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_salary_structure_id_fkey" FOREIGN KEY ("salary_structure_id") REFERENCES "salary_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payslips" ADD CONSTRAINT "payslips_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payslips" ADD CONSTRAINT "payslips_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Row-Level Security: tenant isolation for Payroll / Claims / Advances
-- =========================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
  salary_components, salary_structures, employee_salary_assignments, payroll_runs, payslips, expense_claims, salary_advances, salary_revisions
  TO app_runtime;

ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salary_components_tenant_isolation ON salary_components;
CREATE POLICY salary_components_tenant_isolation ON salary_components
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS salary_structures_tenant_isolation ON salary_structures;
CREATE POLICY salary_structures_tenant_isolation ON salary_structures
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS employee_salary_assignments_tenant_isolation ON employee_salary_assignments;
CREATE POLICY employee_salary_assignments_tenant_isolation ON employee_salary_assignments
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS payroll_runs_tenant_isolation ON payroll_runs;
CREATE POLICY payroll_runs_tenant_isolation ON payroll_runs
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS payslips_tenant_isolation ON payslips;
CREATE POLICY payslips_tenant_isolation ON payslips
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS expense_claims_tenant_isolation ON expense_claims;
CREATE POLICY expense_claims_tenant_isolation ON expense_claims
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS salary_advances_tenant_isolation ON salary_advances;
CREATE POLICY salary_advances_tenant_isolation ON salary_advances
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS salary_revisions_tenant_isolation ON salary_revisions;
CREATE POLICY salary_revisions_tenant_isolation ON salary_revisions
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
