import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

  return <p className="p-6 text-muted-foreground">Signing you in…</p>;
}
