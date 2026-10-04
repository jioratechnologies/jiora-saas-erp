-- Organisation-level pay settings: working days, hours per day, salary split (% of gross, sums to 100).
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "working_days_per_month" INTEGER NOT NULL DEFAULT 22;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "work_hours_per_day" DOUBLE PRECISION NOT NULL DEFAULT 8;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "salary_split" JSONB NOT NULL DEFAULT '{"basic":50,"hra":25,"other":25}';
