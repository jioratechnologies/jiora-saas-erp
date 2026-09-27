import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { RbacModule } from "./rbac/rbac.module";
import { HealthModule } from "./health/health.module";
import { TenantsModule } from "./tenants/tenants.module";
import { AdminModule } from "./admin/admin.module";
import { CacheModule } from "./cache/cache.module";
import { StorageModule } from "./storage/storage.module";
import { HrModule } from "./hr/hr.module";
import { PayrollModule } from "./payroll/payroll.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    RbacModule,
    HealthModule,
    TenantsModule,
    AdminModule,
    CacheModule,
    StorageModule,
    HrModule,
    PayrollModule,
  ],
})
export class AppModule {}
