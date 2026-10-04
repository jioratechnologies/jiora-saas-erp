import { create } from "zustand";
import { ErrorResponse, type User } from "oidc-client-ts";
import { userManager } from "./oidc";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  /** True once the session could not be renewed; UI shows "Your session has expired. Please sign in again." */
  sessionExpired: boolean;
  signIn: (prompt?: "select_account" | "login") => Promise<void>;
  signOut: () => Promise<void>;
  /** Called once at app boot and after the /callback redirect to load any existing session. */
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  sessionExpired: false,
  signIn: async (prompt = "select_account") => {
    await userManager.signinRedirect({
      extraQueryParams: { prompt },
    });
  },
  signOut: async () => {
    const origin = typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "";
    const postLogoutRedirectUri = `${origin}/`;
    try {
      const user = await userManager.getUser();
      const idTokenHint = user?.id_token;
      // Clear local state first
      await userManager.removeUser().catch(() => {});
      await userManager.clearStaleState().catch(() => {});
      set({ user: null, sessionExpired: false });

      // Perform OIDC RP-initiated logout with Zitadel
      await userManager.signoutRedirect({
        post_logout_redirect_uri: postLogoutRedirectUri,
        id_token_hint: idTokenHint,
        extraQueryParams: {
          client_id: import.meta.env.VITE_ZITADEL_CLIENT_ID || "392943470081278469",
        },
      });
    } catch (err) {
      console.warn("Zitadel signoutRedirect error, falling back to local signout:", err);
      window.location.href = "/";
    }
  },
  loadUser: async () => {
    let user = await userManager.getUser();
    if (user?.expired) {
      // Stored token already expired (tab closed overnight etc.): renew before the app sees it.
      await refreshSession();
      user = await userManager.getUser(); // null if the refresh was definitively rejected
    }
    set({ user, isLoading: false });
  },
}));

/** Renew this many seconds before the access token actually expires. */
const REFRESH_SKEW_SECONDS = 60;

let inflightRefresh: Promise<User | null> | null = null;

/**
 * Renews the session via the refresh-token grant (oidc-client-ts signinSilent).
 * All concurrent callers share ONE in-flight promise. A definitive failure
 * (server rejected the refresh token, or no refresh token on an expired
 * session) clears the local user and flags sessionExpired; a transient one
 * (offline, server down) keeps the stored user so it can retry later.
 */
export function refreshSession(): Promise<User | null> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      const current = await userManager.getUser();
      if (!current) return null;
      if (!current.refresh_token) {
        if (current.expired) throw new ErrorResponse({ error: "invalid_grant", error_description: "no refresh token" });
        return current;
      }
      const user = await userManager.signinSilent();
      if (!user) throw new Error("Silent renew returned no user");
      useAuthStore.setState({ user, isLoading: false, sessionExpired: false });
      return user;
    } catch (err) {
      console.warn("Session refresh failed:", err);
      if (err instanceof ErrorResponse) {
        await userManager.removeUser().catch(() => {});
        useAuthStore.setState({ user: null, isLoading: false, sessionExpired: true });
      }
      return null;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

/**
 * Returns an access token that is valid for at least ~60s, refreshing first if needed.
 * `force` refreshes regardless (used after a 401). Null means no usable session.
 */
export async function getValidAccessToken(opts: { force?: boolean } = {}): Promise<string | null> {
  const user = await userManager.getUser();
  if (!user) return null;
  const fresh = user.expires_in === undefined || user.expires_in > REFRESH_SKEW_SECONDS;
  if (fresh && !opts.force) return user.access_token;

  const renewed = await refreshSession();
  if (renewed) return renewed.access_token;

  // Refresh failed transiently: fall back to the stored token while it is still valid (never on force).
  if (opts.force) return null;
  const cur = await userManager.getUser();
  return cur && !cur.expired ? cur.access_token : null;
}

userManager.events.addUserLoaded((user) => useAuthStore.setState({ user, isLoading: false, sessionExpired: false }));
userManager.events.addUserUnloaded(() => useAuthStore.setState({ user: null }));

// Automatic renew failed: try once more shortly (network blip), via the shared refresh path.
userManager.events.addSilentRenewError((err) => {
  console.warn("Silent renew failed, retrying once in 30s:", err);
  setTimeout(() => {
    void getValidAccessToken();
  }, 30_000);
});

// Background tabs throttle timers and sleeping laptops skip them: re-check when the user is back.
if (typeof window !== "undefined") {
  const ensureValid = () => {
    if (document.visibilityState === "visible") void getValidAccessToken();
  };
  document.addEventListener("visibilitychange", ensureValid);
  window.addEventListener("online", ensureValid);
}
