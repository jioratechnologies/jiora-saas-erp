import { create } from "zustand";
import type { User } from "oidc-client-ts";
import { userManager } from "./oidc";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  signIn: (prompt?: "select_account" | "login") => Promise<void>;
  signOut: () => Promise<void>;
  /** Called once at app boot and after the /callback redirect to load any existing session. */
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
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
      set({ user: null });

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
    const user = await userManager.getUser();
    set({ user, isLoading: false });
  },
}));

userManager.events.addUserLoaded((user) => useAuthStore.setState({ user, isLoading: false }));
userManager.events.addUserUnloaded(() => useAuthStore.setState({ user: null }));
