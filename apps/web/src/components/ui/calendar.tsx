import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CalendarProps {
  value?: Date | null;
  onChange?: (date: Date) => void;
  // Range mode props
  mode?: "single" | "range";
  rangeValue?: { start: Date | null; end: Date | null };
  onRangeChange?: (range: { start: Date | null; end: Date | null }) => void;
  minDate?: Date;
  maxDate?: Date;
  isDateDisabled?: (date: Date) => boolean;
  className?: string;
  showTodayButton?: boolean;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isSameDay(d1: Date | null, d2: Date | null): boolean {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isDateInRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const t = date.getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return t > s && t < e;
}

export function Calendar({
  value,
  onChange,
  mode = "single",
  rangeValue,
  onRangeChange,
  minDate,
  maxDate,
  isDateDisabled,
  className,
  showTodayButton = true,
}: CalendarProps) {
  const initialDate = value || rangeValue?.start || new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [yearPageStart, setYearPageStart] = useState(initialDate.getFullYear() - 5);

  const today = useMemo(() => new Date(), []);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setView("days");
    if (mode === "single" && onChange) {
      onChange(now);
    }
  };

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(viewYear, viewMonth - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({
        date: new Date(viewYear, viewMonth, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill complete weeks (up to 42 cells = 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(viewYear, viewMonth + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const handleDayClick = (date: Date) => {
    if (isDateDisabled && isDateDisabled(date)) return;
    if (minDate && date < new Date(new Date(minDate).setHours(0, 0, 0, 0))) return;
    if (maxDate && date > new Date(new Date(maxDate).setHours(23, 59, 59, 999))) return;

    if (mode === "single") {
      onChange?.(date);
    } else if (mode === "range" && onRangeChange) {
      const currentStart = rangeValue?.start;
      const currentEnd = rangeValue?.end;

      if (!currentStart || (currentStart && currentEnd)) {
        // Start a new range
        onRangeChange({ start: date, end: null });
      } else {
        // We have start, completing range
        if (date < currentStart) {
          onRangeChange({ start: date, end: currentStart });
        } else {
          onRangeChange({ start: currentStart, end: date });
        }
      }
    }
  };

  return (
    <div
      className={cn(
        "w-[280px] select-none rounded-2xl border border-zinc-200/80 bg-background p-3.5 shadow-xl shadow-black/5 dark:border-zinc-800",
        className,
      )}
    >
      {/* Month/Year Header */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView(view === "months" ? "days" : "months")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-foreground hover:bg-accent transition-colors",
              view === "months" && "bg-accent",
            )}
            aria-label="Select month"
          >
            {MONTH_NAMES[viewMonth]}
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", view === "months" && "rotate-180")} />
          </button>
          <button
            type="button"
            onClick={() => {
              setYearPageStart(viewYear - 5);
              setView(view === "years" ? "days" : "years");
            }}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-foreground hover:bg-accent transition-colors",
              view === "years" && "bg-accent",
            )}
            aria-label="Select year"
          >
            {viewYear}
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", view === "years" && "rotate-180")} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={view === "years" ? () => setYearPageStart((y) => y - 12) : view === "months" ? () => setViewYear((y) => y - 1) : handlePrevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95 transition-all"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={view === "years" ? () => setYearPageStart((y) => y + 12) : view === "months" ? () => setViewYear((y) => y + 1) : handleNextMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95 transition-all"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === "months" && (
        <div className="grid grid-cols-3 gap-2 py-1">
          {MONTH_NAMES.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setViewMonth(i);
                setView("days");
              }}
              className={cn(
                "rounded-xl py-2.5 text-xs font-medium transition-colors hover:bg-accent",
                i === viewMonth ? "bg-primary text-primary-foreground hover:bg-primary" : "text-foreground",
              )}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      {view === "years" && (
        <div className="grid grid-cols-3 gap-2 py-1">
          {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                setViewYear(y);
                setView("days");
              }}
              className={cn(
                "rounded-xl py-2.5 text-xs font-medium transition-colors hover:bg-accent",
                y === viewYear ? "bg-primary text-primary-foreground hover:bg-primary" : "text-foreground",
                y === today.getFullYear() && y !== viewYear && "ring-1 ring-primary/40 text-primary",
              )}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {view === "days" && (<>
      {/* Weekday labels */}
      <div className="mb-1.5 grid grid-cols-7 text-center">
        {WEEKDAY_NAMES.map((name) => (
          <div key={name} className="text-[11px] font-medium text-muted-foreground/80 py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {calendarDays.map(({ date, isCurrentMonth }, idx) => {
          const isTodayDate = isSameDay(date, today);
          const isSelected = mode === "single" && isSameDay(date, value || null);

          // Range logic
          const isRangeStart =
            mode === "range" && rangeValue?.start && isSameDay(date, rangeValue.start);
          const isRangeEnd =
            mode === "range" && rangeValue?.end && isSameDay(date, rangeValue.end);
          const inRange =
            mode === "range" && isDateInRange(date, rangeValue?.start ?? null, rangeValue?.end ?? null);

          // Range hover preview when only start date is picked
          const isHoverPreview =
            mode === "range" &&
            rangeValue?.start &&
            !rangeValue.end &&
            hoverDate &&
            ((date > rangeValue.start && date <= hoverDate) ||
              (date < rangeValue.start && date >= hoverDate));

          const isDisabled =
            Boolean(isDateDisabled && isDateDisabled(date)) ||
            Boolean(minDate && date < new Date(new Date(minDate).setHours(0, 0, 0, 0))) ||
            Boolean(maxDate && date > new Date(new Date(maxDate).setHours(23, 59, 59, 999)));

          return (
            <div
              key={idx}
              className={cn(
                "relative flex items-center justify-center py-0.5",
                (inRange || isHoverPreview) && "bg-primary/10",
                isRangeStart && "rounded-l-xl bg-primary/10",
                isRangeEnd && "rounded-r-xl bg-primary/10",
              )}
            >
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => handleDayClick(date)}
                onMouseEnter={() => mode === "range" && setHoverDate(date)}
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center text-xs font-medium transition-all duration-150",
                  "rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  !isCurrentMonth && "text-muted-foreground/40",
                  isCurrentMonth && !isSelected && !isRangeStart && !isRangeEnd && "text-foreground hover:bg-accent",
                  isTodayDate && !isSelected && !isRangeStart && !isRangeEnd && "font-bold text-primary ring-1 ring-primary/40",
                  (isSelected || isRangeStart || isRangeEnd) &&
                    "bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 active:scale-95",
                  isDisabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
                )}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      </>)}

      {/* Footer / Today shortcut */}
      {showTodayButton && (
        <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={handleJumpToToday}
            className="text-xs font-semibold text-primary hover:underline underline-offset-2"
          >
            Today
          </button>
          {mode === "range" && rangeValue?.start && (
            <span className="text-[11px] text-muted-foreground">
              {rangeValue.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {rangeValue.end
                ? ` – ${rangeValue.end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : " – Select end date"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
