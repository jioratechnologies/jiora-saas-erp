import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { userManager } from "../auth/oidc";
import { api } from "../api/client";

/** Zitadel redirects here after login. Completes the PKCE exchange, then claims any pending invite. */
export function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    userManager
      .signinRedirectCallback()
      .then(() => api.post("/auth/claim-invite"))
      .catch(() => {
        // Not a pending invite (already claimed, or a platform user) — fine, ignore.
      })
      .finally(() => navigate("/", { replace: true }));
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Signing you in…
    </div>
  );
}
