import { create } from "zustand";
import type { User } from "oidc-client-ts";
import { userManager } from "./oidc";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Called once at app boot and after the /callback redirect to load any existing session. */
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  signIn: async () => {
    await userManager.signinRedirect();
  },
  signOut: async () => {
    await userManager.signoutRedirect();
    set({ user: null });
  },
  loadUser: async () => {
    const user = await userManager.getUser();
    set({ user, isLoading: false });
  },
}));

userManager.events.addUserLoaded((user) => useAuthStore.setState({ user, isLoading: false }));
userManager.events.addUserUnloaded(() => useAuthStore.setState({ user: null }));
