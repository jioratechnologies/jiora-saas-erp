import { useAuthStore } from "../auth/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn);
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center pb-2 pt-6 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            S
          </span>
          <CardTitle className="text-base">saas-erp</CardTitle>
          <CardDescription>Sign in to continue to your workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={signIn} className="w-full">
            Sign in with Zitadel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
