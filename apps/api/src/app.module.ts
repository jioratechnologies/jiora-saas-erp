import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { TimingInterceptor } from "./common/timing.interceptor";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
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
import { MailModule } from "./mail/mail.module";

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
    MailModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
  ],
})
export class AppModule {}
