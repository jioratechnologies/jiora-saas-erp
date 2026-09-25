import { Controller, Get, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { bearerTokenFrom, fetchUserInfo } from "./verify-token";
import { ZitadelAuthGuard } from "./zitadel-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { AuthContext } from "./auth-context";

/**
 * First-login endpoint: a user who was invited by email (User row exists,
 * zitadel_subject_id is still null) calls this once, right after their
 * first successful Zitadel login, to link that Zitadel identity to their
 * invited profile. See claim_invite() in
 * prisma/migrations/20260925035752_nullable_subject_and_claim_invite.
 *
 * Deliberately takes no request body — the email comes only from Zitadel's
 * own UserInfo endpoint (see fetchUserInfo in verify-token.ts), never from
 * client input, so this can't be used to claim an arbitrary invite.
 */
@ApiTags("auth")
@ApiBearerAuth()
@Controller("auth")
export class ClaimInviteController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("claim-invite")
  async claimInvite(@Req() request: Request) {
    let subject: string;
    let email: string;
    try {
      const token = bearerTokenFrom(request.headers.authorization);
      const info = await fetchUserInfo(token);
      if (!info.sub || !info.email) {
        throw new Error("userinfo missing sub or email");
      }
      subject = info.sub;
      email = info.email;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ user_id: string; tenant_id: string | null; is_platform: boolean; permission_keys: string[] }>
    >`SELECT * FROM claim_invite(${subject}, ${email})`;

    const row = rows[0];
    if (!row) {
      return { claimed: false };
    }
    return { claimed: true, tenantId: row.tenant_id };
  }

  /**
   * "Who am I" — the one thing the frontend needs before it can decide where
   * to route a freshly-logged-in user: platform staff land on /platform/tenants,
   * tenant users land on /admin/org. No @RequirePermission — any resolved
   * identity can ask who they are.
   */
  @Get("me")
  @UseGuards(ZitadelAuthGuard)
  me(@CurrentUser() user: AuthContext) {
    return {
      userId: user.userId,
      tenantId: user.tenantId,
      isPlatformContext: user.isPlatformContext,
      permissionKeys: Array.from(user.permissionKeys),
    };
  }
}
