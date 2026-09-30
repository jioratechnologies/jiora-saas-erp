import type { ReactNode } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription } from "./ui/alert";

/**
 * Every page's fetch has three real states — loading, error, data.
 * Displays animated loading or custom skeleton during load, and friendly
 * server error messaging if the API is offline or returns an error.
 */
export function QueryState({
  isLoading,
  error,
  children,
  skeleton,
  loadingMessage = "Loading data from server...",
}: {
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
  /** Custom loading placeholder shaped like the real content. Falls back to generic bars. */
  skeleton?: ReactNode;
  loadingMessage?: string;
}) {
  if (isLoading) {
    return (
      skeleton ?? (
        <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">{loadingMessage}</p>
        </div>
      )
    );
  }
  if (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return (
      <Alert variant="destructive" className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/30">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-xs font-medium">
            Couldn't load data: {message || "The server is temporarily unavailable. Please verify the API is running."}
          </AlertDescription>
        </div>
      </Alert>
    );
  }
  return <>{children}</>;
}
