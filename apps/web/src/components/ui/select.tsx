import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/**
 * HeroUI-inspired styled Select — replaces native <select>.
 * Maintains full native accessibility + keyboard nav.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              "w-full appearance-none cursor-pointer rounded-xl border bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground",
              "border-zinc-200 dark:border-zinc-800",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500 focus:ring-red-500",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          {/* Custom chevron arrow */}
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
        {error && <p className="text-xs text-red-500 leading-tight">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";
