import type { HTMLAttributes, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export function Alert({
  variant = "default",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        variant === "destructive"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-muted/50 text-foreground",
        className,
      )}
      {...props}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function AlertDescription({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed">{children}</p>;
}
