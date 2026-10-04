import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { Logger } from "@nestjs/common";

const logger = new Logger("verify-token");

// Read env lazily (first use), not at import time, so ConfigModule/dotenv has loaded.
function getIssuer(): string {
  return process.env.ZITADEL_ISSUER ?? "http://localhost:8080";
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function getJwks() {
  jwks ??= createRemoteJWKSet(new URL(`${getIssuer()}/oauth/v2/keys`));
  return jwks;
}

let warnedNoAudience = false;
function getAudience(): string | undefined {
  const audience = process.env.ZITADEL_PROJECT_ID;
  if (audience) return audience;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ZITADEL_PROJECT_ID is not set; refusing to verify tokens without audience check");
  }
  if (!warnedNoAudience) {
    warnedNoAudience = true;
    logger.warn("ZITADEL_PROJECT_ID not set; skipping audience check (dev only)");
  }
  return undefined;
}

/** Verifies signature, issuer and audience. Callers decide what to do with the resulting claims. */
export async function verifyZitadelToken(token: string): Promise<JWTPayload> {
  const audience = getAudience();
  const { payload } = await jwtVerify(token, getJwks(), { issuer: getIssuer(), ...(audience ? { audience } : {}) });
  return payload;
}

export function bearerTokenFrom(authHeader: string | undefined): string {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }
  return authHeader.slice("Bearer ".length);
}

/**
 * Zitadel doesn't embed profile-scope claims (email, name) in the access
 * token or even the id_token by default — both come back with only
 * iss/sub/aud/exp. The only reliable way to get a verified email for a
 * token is Zitadel's own UserInfo endpoint: it only returns data for a
 * genuinely valid, non-expired token, so this call itself doubles as
 * verification — no separate local JWT check needed alongside it.
 * Used only by claim-invite; ZitadelAuthGuard never needs email, only sub.
 */
export async function fetchUserInfo(accessToken: string): Promise<{ sub: string; email?: string }> {
  const res = await fetch(`${getIssuer()}/oidc/v1/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`UserInfo request failed: ${res.status}`);
  return (await res.json()) as { sub: string; email?: string };
}
