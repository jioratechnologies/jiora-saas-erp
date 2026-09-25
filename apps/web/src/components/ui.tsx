import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/**
 * Small hand-rolled primitives, styled with the same CSS variables shadcn/ui
 * components use (--primary, --border, etc — see src/index.css). Swap any
 * of these for the real `npx shadcn add <component>` version incrementally
 * as the UI grows; the theming foundation underneath is already compatible.
 */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-background p-6 ${className}`}>{children}</div>;
}

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded border border-border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary ${className}`}
      {...props}
    />
  );
}

export function PageHeading({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-lg font-semibold">{children}</h1>;
}

/**
 * Every page's fetch has three real states — loading, error, data — but it's
 * easy to only handle the first two and let a failed request (e.g. 403 from
 * a missing permission) render as an infinite "Loading…" forever. This makes
 * the error state impossible to skip by accident.
 */
export function QueryState({
  isLoading,
  error,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
}) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return (
      <p className="text-sm text-red-600">
        Couldn't load this: {message || "(no server message — check the API is running and reachable)"}
      </p>
    );
  }
  return <>{children}</>;
}
