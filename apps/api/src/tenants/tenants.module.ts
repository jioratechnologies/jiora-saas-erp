import { Module } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";
import { TenantsPublicController } from "./tenants.public.controller";
import { TenantsService } from "./tenants.service";

@Module({
  controllers: [TenantsController, TenantsPublicController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
