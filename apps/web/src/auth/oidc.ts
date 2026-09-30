import { UserManager, WebStorageStateStore } from "oidc-client-ts";

const origin = typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "";
const postLogoutUri = `${origin}/`;

/**
 * One shared UserManager for the whole app. `oidc-client-ts` is Zitadel's
 * own recommended library for SPA login (Authorization Code + PKCE — no
 * client secret in the browser). See docs/adr/0002-zitadel-for-authn.md.
 *
 * Every tenant logs into the SAME Zitadel instance/client — Zitadel's own
 * "Organization" concept is what separates them on Zitadel's side, not a
 * separate OIDC client per tenant.
 */
export const userManager = new UserManager({
  authority: import.meta.env.VITE_ZITADEL_ISSUER ?? "http://localhost:8080",
  client_id: import.meta.env.VITE_ZITADEL_CLIENT_ID ?? "",
  redirect_uri: `${origin}/callback`,
  post_logout_redirect_uri: postLogoutUri,
  response_type: "code",
  // offline_access is what gets a refresh token issued at all — without it,
  // automaticSilentRenew has nothing to renew with (no iframe-based silent
  // renew configured here), the access token just expires, and every
  // request 401s until the next full sign-in. This is why it 401'd.
  scope: "openid profile email offline_access",
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
});
