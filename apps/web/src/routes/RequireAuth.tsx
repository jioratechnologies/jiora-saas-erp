import type { ReactNode } from "react";
import { useAuthStore } from "../auth/auth-store";
import { LoginPage } from "./LoginPage";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (!user) return <LoginPage />;
  return <>{children}</>;
}
