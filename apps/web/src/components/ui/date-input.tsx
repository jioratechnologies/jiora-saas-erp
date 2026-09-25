import { forwardRef, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

/**
 * HeroUI-inspired Date Input — wraps a native date input with custom styling.
 * Uses the browser's native date picker but with themed borders, rounded corners,
 * and an icon — consistent with the rest of the design system.
 */
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
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
          <input
            ref={ref}
            id={inputId}
            type="date"
            className={cn(
              "w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground",
              "border-zinc-200 dark:border-zinc-800",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all",
              "disabled:cursor-not-allowed disabled:opacity-50",
              // Style the date picker icon
              "[color-scheme:light] dark:[color-scheme:dark]",
              error && "border-red-500 focus:ring-red-500",
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-500 leading-tight">{error}</p>}
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
