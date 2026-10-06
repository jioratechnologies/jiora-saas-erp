import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../auth/auth-store";
import { LoginPage } from "./LoginPage";

/** Public /login page (target of invitation emails). Signed-in users go straight to the app. */
export function LoginRoute() {
  const { user, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}
