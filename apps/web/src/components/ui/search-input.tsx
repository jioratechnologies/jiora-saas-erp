import { forwardRef, useRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "size"> {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Called by the clear button; defaults to emitting an empty change event. */
  onClear?: () => void;
  /** Shown at the right while the box is empty (e.g. a keyboard-shortcut hint). */
  trailing?: ReactNode;
  /** Applied to the outer bordered box (width, height, margins). */
  className?: string;
  /** Applied to the inner <input>. */
  inputClassName?: string;
}

/**
 * The one search box for the app. Border colour derives from the runtime-themable
 * --primary token (visible at rest, stronger on hover, full + ring on focus).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, trailing, className, inputClassName, placeholder = "Search…", ...rest }, ref) => {
    const innerRef = useRef<HTMLInputElement | null>(null);
    const setRefs = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const clear = () => {
      if (onClear) onClear();
      else onChange({ target: { value: "" }, currentTarget: { value: "" } } as ChangeEvent<HTMLInputElement>);
      innerRef.current?.focus();
    };

    return (
      <div
        className={cn(
          "relative flex h-9 w-full items-center rounded-xl border border-primary/30 bg-background transition-all duration-150",
          "hover:border-primary/60 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          className,
        )}
      >
        <Search className="pointer-events-none absolute left-3 h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={setRefs}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-label={rest["aria-label"] ?? placeholder}
          {...rest}
          className={cn(
            "h-full w-full min-w-0 bg-transparent pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            inputClassName,
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          trailing && <div className="absolute right-2 flex items-center">{trailing}</div>
        )}
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";
