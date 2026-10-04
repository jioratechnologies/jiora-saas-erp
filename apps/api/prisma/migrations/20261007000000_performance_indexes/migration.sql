-- Performance indexes. Idempotent; no CONCURRENTLY (migration runs in a transaction).
-- Btree indexes below are mirrored in schema.prisma via @@index(..., map: "<name>").
-- GIN trigram indexes at the bottom are NOT expressible in schema.prisma; they live only here.

-- persons list: WHERE tenant_id ORDER BY status, first_name, id (cursor paging)
CREATE INDEX IF NOT EXISTS idx_persons_tenant_id_status_first_name_id ON persons (tenant_id, status, first_name, id);

-- attendance admin list: WHERE tenant_id AND date range ORDER BY date DESC, check_in_time DESC
CREATE INDEX IF NOT EXISTS idx_attendances_tenant_id_date_check_in_time ON attendances (tenant_id, date DESC, check_in_time DESC);

-- leave request list: WHERE tenant_id ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant_id_created_at ON leave_requests (tenant_id, created_at DESC);

-- claims / advances list: WHERE tenant_id [AND status] ORDER BY created_at DESC.
-- Supersedes the old (tenant_id, status) indexes, which are now a prefix of these.
CREATE INDEX IF NOT EXISTS idx_expense_claims_tenant_id_status_created_at ON expense_claims (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_salary_advances_tenant_id_status_created_at ON salary_advances (tenant_id, status, created_at DESC);
DROP INDEX IF EXISTS expense_claims_tenant_id_status_idx;
DROP INDEX IF EXISTS salary_advances_tenant_id_status_idx;

-- role -> users reverse lookup and ON DELETE CASCADE from roles
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);

-- Trigram search: Prisma `contains` + mode "insensitive" compiles to ILIKE '%term%'.
-- An OR across columns only uses indexes if every column is indexed, so all searched columns are covered.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_persons_first_name_trgm ON persons USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_persons_middle_name_trgm ON persons USING gin (middle_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_persons_last_name_trgm ON persons USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_persons_email_trgm ON persons USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_persons_phone_trgm ON persons USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_expense_claims_title_trgm ON expense_claims USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_expense_claims_description_trgm ON expense_claims USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_salary_advances_reason_trgm ON salary_advances USING gin (reason gin_trgm_ops);
