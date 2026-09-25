import type { ReactNode } from "react";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription } from "./ui/alert";

/**
 * Every page's fetch has three real states — loading, error, data — but
 * it's easy to only handle the first two and let a failed request (e.g. 403
 * from a missing permission) render as an infinite loading skeleton
 * forever. This makes the error state impossible to skip by accident.
 */
export function QueryState({
  isLoading,
  error,
  children,
  skeleton,
}: {
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
  /** Custom loading placeholder shaped like the real content. Falls back to generic bars. */
  skeleton?: ReactNode;
}) {
  if (isLoading) {
    return (
      skeleton ?? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      )
    );
  }
  if (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn't load this: {message || "(no server message — check the API is running and reachable)"}
        </AlertDescription>
      </Alert>
    );
  }
  return <>{children}</>;
}
