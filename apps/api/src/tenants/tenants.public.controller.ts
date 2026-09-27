import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TenantsService } from "./tenants.service";

@ApiTags("tenants (public)")
@Controller("public/tenants")
export class TenantsPublicController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @ApiOperation({ summary: "List active public organisations with branding (name, slug, logo, primary color)" })
  list() {
    return this.tenants.listPublicTenants();
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get public branding for an organisation by slug" })
  getBranding(@Param("slug") slug: string) {
    return this.tenants.getPublicBranding(slug);
  }
}
