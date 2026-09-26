import { forwardRef, useState, useEffect, type InputHTMLAttributes } from "react";
import { CalendarDays, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label?: string;
  error?: string;
  helperText?: string;
  value?: string | null;
  onChange?: (dateString: string) => void;
  format?: string; // Display hint, e.g. "YYYY-MM-DD"
}

/**
 * DateField component with formatted text input, clear action,
 * error state, and icon adornment.
 */
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  ({ className, label, error, helperText, value, onChange, disabled, placeholder = "YYYY-MM-DD", ...props }, ref) => {
    const [inputValue, setInputValue] = useState(value || "");

    useEffect(() => {
      setInputValue(value || "");
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      onChange?.(val);
    };

    const handleClear = () => {
      setInputValue("");
      onChange?.("");
    };

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-semibold text-foreground">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
          </span>
          <input
            ref={ref}
            type="text"
            disabled={disabled}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleTextChange}
            className={cn(
              "w-full rounded-xl border bg-background py-2.5 pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground/60",
              "border-zinc-200 dark:border-zinc-800",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500 focus:ring-red-500",
              className,
            )}
            {...props}
          />
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear date"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-500 leading-tight">{error}</p>}
        {!error && helperText && <p className="text-xs text-muted-foreground leading-tight">{helperText}</p>}
      </div>
    );
  },
);

DateField.displayName = "DateField";
