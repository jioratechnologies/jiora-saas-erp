# Performance indexes (migration 20261007000000_performance_indexes)

Every index is tenant-first, because every query filters by tenant. Existing indexes that already served a query were left alone.

| Index | Table | Query it serves |
|---|---|---|
| idx_persons_tenant_id_status_first_name_id | persons | People list sorted by status, name (cursor paging) |
| idx_attendances_tenant_id_date_check_in_time | attendances | Admin attendance list by date range, newest first |
| idx_leave_requests_tenant_id_created_at | leave_requests | Leave request list, newest first |
| idx_expense_claims_tenant_id_status_created_at | expense_claims | Claims list, optional status filter, newest first (replaces the old tenant+status index) |
| idx_salary_advances_tenant_id_status_created_at | salary_advances | Advances list, same pattern (replaces the old tenant+status index) |
| idx_user_roles_role_id | user_roles | Finding users of a role; role deletes |
| idx_persons_{first_name,middle_name,last_name,email,phone}_trgm | persons | Search box (ILIKE '%term%') on People and Payroll |
| idx_expense_claims_{title,description}_trgm | expense_claims | Claims search |
| idx_salary_advances_reason_trgm | salary_advances | Advances search |

The trigram (GIN) indexes need the `pg_trgm` extension and exist only in the migration, not in `schema.prisma`.

## After deploy: check on the VM

Run in psql as the app role. Look for "Index Scan", "Index Only Scan" or "Bitmap Index Scan" on the idx_ names, not "Seq Scan". On tiny tables Postgres may still pick a seq scan; test with real data volume.

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM persons WHERE tenant_id = '<tenant>' AND (first_name ILIKE '%ann%' OR last_name ILIKE '%ann%' OR email ILIKE '%ann%' OR phone ILIKE '%ann%');

EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM attendances WHERE tenant_id = '<tenant>' AND date >= '2026-10-01' AND date <= '2026-10-31' ORDER BY date DESC, check_in_time DESC LIMIT 200;

EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM expense_claims WHERE tenant_id = '<tenant>' AND status = 'SUBMITTED' ORDER BY created_at DESC LIMIT 50;
```

Note: the app runs with row-level security, so set the tenant context (as the app does) before running these, or results will be empty.
