import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Thin wrapper around PrismaClient with one addition: runInTenantContext.
 *
 * Every query that touches a tenant-scoped table MUST go through
 * runInTenantContext, so the RLS session variables (app.tenant_id,
 * app.is_platform_context — see the enable_row_level_security migration)
 * are set inside the same transaction as the query. Calling
 * `this.department.findMany()` directly instead would run outside any
 * tenant context and RLS would filter out every row, not none of them.
 */
/**
 * Interactive-transaction defaults. Prisma's own defaults (maxWait 2s, timeout 5s)
 * are too tight when the DB is a remote VM: each tenant tx makes several
 * sequential round trips, so it hit "Transaction already closed". Env-overridable.
 */
/**
 * Pool sizing: set it via DATABASE_URL query params, e.g.
 *   ?connection_limit=10&pool_timeout=20   (Prisma default connection_limit = num_cpus*2+1)
 * With a remote DB (~40ms RTT) keep connection_limit >= expected concurrent requests but below
 * Postgres max_connections / number of API instances; behind PgBouncer add &pgbouncer=true.
 */
const envMs = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
export const TX_DEFAULTS = {
  maxWait: envMs("PRISMA_TX_MAX_WAIT_MS", 15_000),
  timeout: envMs("PRISMA_TX_TIMEOUT_MS", 30_000),
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ transactionOptions: { ...TX_DEFAULTS } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async runInTenantContext<T>(
    ctx: { tenantId: string | null; isPlatformContext: boolean },
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // set_config(..., true) is transaction-local ("true" = is_local), which
      // is what makes this safe under PgBouncer transaction pooling — the
      // setting never leaks to the next request that happens to reuse the
      // same physical connection.
      // One statement (one round trip) sets both variables.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId ?? ""}, true), set_config('app.is_platform_context', ${ctx.isPlatformContext ? "true" : "false"}, true)`;
      return fn(tx);
    }, { ...TX_DEFAULTS, ...options });
  }
}
