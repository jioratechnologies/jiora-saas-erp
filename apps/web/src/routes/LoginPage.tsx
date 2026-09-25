import { useAuthStore } from "../auth/auth-store";

export function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="rounded-lg border border-border p-8 text-center">
        <h1 className="mb-4 text-xl font-semibold">saas-erp</h1>
        <button
          onClick={signIn}
          className="rounded bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
