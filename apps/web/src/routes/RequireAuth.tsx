import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../auth/auth-store";
import { LoginPage } from "./LoginPage";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!user) return <LoginPage />;
  return <>{children}</>;
}
