import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const issuer = process.env.ZITADEL_ISSUER ?? "http://localhost:8080";
const jwks = createRemoteJWKSet(new URL(`${issuer}/oauth/v2/keys`));

/** Verifies signature + issuer only. Callers decide what to do with the resulting claims. */
export async function verifyZitadelToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, jwks, { issuer });
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
  const res = await fetch(`${issuer}/oidc/v1/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`UserInfo request failed: ${res.status}`);
  return (await res.json()) as { sub: string; email?: string };
}
