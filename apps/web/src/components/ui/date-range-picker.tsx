import { useState, useRef, useEffect, forwardRef } from "react";
import { CalendarDays, X, ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { Calendar } from "./calendar";
import { PopoverPortal, useFloatingPosition } from "./popover-portal";

export interface DateRangeValue {
  start: string | Date | null;
  end: string | Date | null;
}

export interface DateRangePickerProps {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  value?: DateRangeValue;
  onChange?: (range: {
    start: string;
    end: string;
    startDate: Date | null;
    endDate: Date | null;
  }) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  isRequired?: boolean;
}

function parseDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "string") {
    const parts = val.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatDateToISO(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const DateRangePicker = forwardRef<HTMLDivElement, DateRangePickerProps>(
  (
    {
      label,
      error,
      helperText,
      placeholder = "Select date range",
      value,
      onChange,
      minDate,
      maxDate,
      disabled = false,
      className,
      isRequired = false,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const coords = useFloatingPosition(triggerRef, isOpen, 340);

    const startDate = parseDate(value?.start);
    const endDate = parseDate(value?.end);

    const [rangeState, setRangeState] = useState<{ start: Date | null; end: Date | null }>({
      start: startDate,
      end: endDate,
    });

    useEffect(() => {
      setRangeState({
        start: parseDate(value?.start),
        end: parseDate(value?.end),
      });
    }, [value?.start, value?.end]);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          triggerRef.current &&
          !triggerRef.current.contains(target) &&
          popoverRef.current &&
          !popoverRef.current.contains(target)
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isOpen) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        window.addEventListener("keydown", handleKeyDown);
      }
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen]);

    const handleRangeChange = (newRange: { start: Date | null; end: Date | null }) => {
      setRangeState(newRange);
      if (newRange.start && newRange.end) {
        onChange?.({
          start: formatDateToISO(newRange.start),
          end: formatDateToISO(newRange.end),
          startDate: newRange.start,
          endDate: newRange.end,
        });
        setIsOpen(false);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setRangeState({ start: null, end: null });
      onChange?.({ start: "", end: "", startDate: null, endDate: null });
    };

    const startStr = startDate
      ? startDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "";
    const endStr = endDate
      ? endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "";

    return (
      <div className={cn("relative w-full space-y-1.5", className)}>
        {label && (
          <label className="block text-xs font-semibold text-foreground">
            {label}
            {isRequired && <span className="ml-0.5 text-red-500">*</span>}
          </label>
        )}

        {/* Trigger button */}
        <div
          ref={triggerRef}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled) setIsOpen((prev) => !prev);
            }
          }}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between rounded-xl border bg-background px-3.5 py-2.5 text-sm transition-all duration-150 select-none",
            "border-zinc-200 dark:border-zinc-800",
            "hover:border-zinc-300 dark:hover:border-zinc-700",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
            isOpen && "ring-2 ring-primary border-primary",
            disabled && "cursor-not-allowed opacity-50 hover:border-zinc-200",
            error && "border-red-500 focus-visible:ring-red-500",
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            {startStr ? (
              <div className="flex items-center gap-1.5 text-foreground font-medium text-xs sm:text-sm">
                <span>{startStr}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span>{endStr || "..."}</span>
              </div>
            ) : (
              <span className="truncate text-sm text-muted-foreground/60">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {startStr && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800 transition-colors"
                aria-label="Clear date range"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
          </div>
        </div>

        {/* Portal-rendered Calendar Popover */}
        <PopoverPortal isOpen={isOpen && Boolean(coords)}>
          {coords && (
            <div
              ref={popoverRef}
              style={{
                position: "fixed",
                top: coords.top !== undefined ? `${coords.top}px` : undefined,
                bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
                left: `${coords.left}px`,
                zIndex: 99999,
              }}
              className="animate-in fade-in-0 zoom-in-95 duration-150"
            >
              <Calendar
                mode="range"
                rangeValue={rangeState}
                onRangeChange={handleRangeChange}
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>
          )}
        </PopoverPortal>

        {error && <p className="text-xs text-red-500 leading-tight">{error}</p>}
        {!error && helperText && <p className="text-xs text-muted-foreground leading-tight">{helperText}</p>}
      </div>
    );
  },
);

DateRangePicker.displayName = "DateRangePicker";
