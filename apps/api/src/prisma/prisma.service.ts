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
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async runInTenantContext<T>(
    ctx: { tenantId: string | null; isPlatformContext: boolean },
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // set_config(..., true) is transaction-local ("true" = is_local), which
      // is what makes this safe under PgBouncer transaction pooling — the
      // setting never leaks to the next request that happens to reuse the
      // same physical connection.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId ?? ""}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_context', ${ctx.isPlatformContext ? "true" : "false"}, true)`;
      return fn(tx);
    });
  }
}
