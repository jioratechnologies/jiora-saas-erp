import { Controller, Get, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { bearerTokenFrom, fetchUserInfo } from "./verify-token";
import { AuthzCacheService } from "./authz-cache.service";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly authzCache: AuthzCacheService,
  ) {}

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
  async me(@CurrentUser() user: AuthContext) {
    let roles: string[] = [];
    let availableTenants: Array<{ id: string; name: string; slug: string; logoUrl: string | null }> = [];
    if (user.isPlatformContext) {
      availableTenants = await this.prisma.runInTenantContext(
        { tenantId: null, isPlatformContext: true },
        (tx) =>
          tx.tenant.findMany({
            where: { suspendedAt: null },
            select: { id: true, name: true, slug: true, logoUrl: true },
            orderBy: { name: "asc" },
          }),
      );
      roles = user.tenantId
        ? ["Platform Super Admin", "Tenant Owner (Super Admin)"]
        : ["Platform Super Admin"];
    } else if (user.tenantId) {
      const tenantId = user.tenantId;
      // Roles/designation change only via writes that bump the authz generation, so cache them like the guard identity (one Redis read, no DB tx on a hit).
      const key = `me:roles:${tenantId}:${user.userId}`;
      const { value, gen } = await this.authzCache.read<string[]>(key);
      if (value) {
        roles = value;
      } else {
        const profile = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
          tx.user.findUnique({
            where: { id: user.userId },
            select: {
              roles: { select: { role: { select: { name: true } } } },
              designation: { select: { name: true } },
              person: { select: { designation: { select: { name: true } } } },
            },
          }),
        );
        const designationName = profile?.person?.designation?.name ?? profile?.designation?.name;
        roles = [...(profile?.roles.map((ur) => ur.role.name) ?? []), ...(designationName ? [designationName] : [])];
        await this.authzCache.write(key, gen, roles, 300);
      }
    }

    return {
      userId: user.userId,
      tenantId: user.tenantId,
      isPlatformContext: user.isPlatformContext,
      roles,
      permissionKeys: Array.from(user.permissionKeys),
      availableTenants,
    };
  }
}
