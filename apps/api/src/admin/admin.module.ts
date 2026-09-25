import { Module } from "@nestjs/common";
import { OrgController } from "./org.controller";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsService } from "./departments.service";
import { DesignationsController } from "./designations.controller";
import { DesignationsService } from "./designations.service";
import { RolesController } from "./roles.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { TenantsModule } from "../tenants/tenants.module";

/** The tenant Admin panel: org profile, departments, designations, Role Builder, users. */
@Module({
  imports: [TenantsModule],
  controllers: [OrgController, DepartmentsController, DesignationsController, RolesController, UsersController],
  providers: [DepartmentsService, DesignationsService, UsersService],
})
export class AdminModule {}
