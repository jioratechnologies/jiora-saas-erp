import { Global, Module } from "@nestjs/common";
import { ZitadelAuthGuard } from "./zitadel-auth.guard";
import { PermissionsGuard } from "./permissions.guard";
import { ClaimInviteController } from "./claim-invite.controller";
import { ProfileController } from "./profile.controller";

/**
 * @Global: every module can use ZitadelAuthGuard/PermissionsGuard without
 * re-importing this module. They are applied per-controller with
 * `@UseGuards(ZitadelAuthGuard, PermissionsGuard)`, not globally on every
 * route — the health check and POST /auth/claim-invite, for example,
 * deliberately have neither (claim-invite does its own lighter check, since
 * by definition the caller has no resolved app-side identity yet).
 */
@Global()
@Module({
  controllers: [ClaimInviteController, ProfileController],
  providers: [ZitadelAuthGuard, PermissionsGuard],
  exports: [ZitadelAuthGuard, PermissionsGuard],
})
export class AuthModule {}
