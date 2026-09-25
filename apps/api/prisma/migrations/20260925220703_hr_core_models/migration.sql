-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('EMPLOYEE', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('JOINED', 'PROBATION', 'ACTIVE', 'NOTICE_PERIOD', 'EXITED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('KYC', 'RESUME', 'JOINING_LETTER', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceMode" AS ENUM ('OFFICE', 'REMOTE', 'FIELD', 'ON_DUTY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'HALF_DAY', 'ABSENT', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "LeaveApplicability" AS ENUM ('EMPLOYEE_ONLY', 'ALL');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "person_type" "PersonType" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "gender" TEXT,
    "dob" TIMESTAMP(3),
    "address" TEXT,
    "emergency_contact" TEXT,
    "department_id" TEXT,
    "designation_id" TEXT,
    "manager_id" TEXT,
    "joining_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmation_date" TIMESTAMP(3),
    "exit_date" TIMESTAMP(3),
    "exit_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "check_in_time" TIMESTAMP(3) NOT NULL,
    "check_out_time" TIMESTAMP(3),
    "mode" "AttendanceMode" NOT NULL DEFAULT 'OFFICE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location_name" TEXT,
    "notes" TEXT,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "annual_quota" INTEGER NOT NULL DEFAULT 12,
    "applicable_to" "LeaveApplicability" NOT NULL DEFAULT 'ALL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_count" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approver_id" TEXT,
    "decision_notes" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "persons_user_id_key" ON "persons"("user_id");

-- CreateIndex
CREATE INDEX "persons_tenant_id_person_type_status_idx" ON "persons"("tenant_id", "person_type", "status");

-- CreateIndex
CREATE INDEX "persons_tenant_id_department_id_idx" ON "persons"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "persons_tenant_id_designation_id_idx" ON "persons"("tenant_id", "designation_id");

-- CreateIndex
CREATE INDEX "persons_tenant_id_manager_id_idx" ON "persons"("tenant_id", "manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "persons_tenant_id_email_key" ON "persons"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "person_documents_tenant_id_person_id_category_idx" ON "person_documents"("tenant_id", "person_id", "category");

-- CreateIndex
CREATE INDEX "attendances_tenant_id_date_status_idx" ON "attendances"("tenant_id", "date", "status");

-- CreateIndex
CREATE INDEX "attendances_tenant_id_person_id_check_in_time_idx" ON "attendances"("tenant_id", "person_id", "check_in_time");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_tenant_id_person_id_date_key" ON "attendances"("tenant_id", "person_id", "date");

-- CreateIndex
CREATE INDEX "leave_types_tenant_id_is_active_idx" ON "leave_types"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_tenant_id_code_key" ON "leave_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_approver_id_status_idx" ON "leave_requests"("tenant_id", "approver_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_person_id_status_idx" ON "leave_requests"("tenant_id", "person_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_start_date_end_date_idx" ON "leave_requests"("tenant_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "holidays_tenant_id_date_idx" ON "holidays"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_tenant_id_date_name_key" ON "holidays"("tenant_id", "date", "name");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================
-- Row-Level Security: DB-enforced Tenant Isolation for HR Core
-- =========================================================

-- 1) Grant privileges to app_runtime role
GRANT SELECT, INSERT, UPDATE, DELETE ON
  persons, person_documents, attendances, leave_types, leave_requests, holidays
  TO app_runtime;

-- 2) Enable Row-Level Security on every new tenant-scoped table
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- 3) Tenant isolation policies using app.tenant_id
CREATE POLICY persons_tenant_isolation ON persons
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY person_documents_tenant_isolation ON person_documents
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY attendances_tenant_isolation ON attendances
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY leave_types_tenant_isolation ON leave_types
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY leave_requests_tenant_isolation ON leave_requests
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY holidays_tenant_isolation ON holidays
  USING (tenant_id = current_setting('app.tenant_id', true));

