import { SearchInput } from "./search-input";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { PopoverPortal, useFloatingPosition } from "./popover-portal";

// ─── Select Option Interface ──────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  placeholder?: string;
  options?: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  error?: string;
  helperText?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  isRequired?: boolean;
  name?: string;
  id?: string;
  className?: string;
  triggerClassName?: string;
  size?: "xs" | "sm" | "md" | "lg";
  children?: ReactNode;
}

const selectSizeClasses = {
  xs: "h-7 px-2.5 py-0 text-xs rounded-lg gap-1.5",
  sm: "h-8 px-3 py-0 text-xs rounded-xl gap-2",
  md: "h-10 px-3.5 py-2 text-sm rounded-xl gap-2.5",
  lg: "h-12 px-4 py-2.5 text-base rounded-2xl gap-3",
};

const selectIconSizes = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4.5 w-4.5",
};

/**
 * Custom Dropdown Select with floating popover listbox, portal rendering,
 * search filtering, keyboard accessibility, optgroup support, and backward compatibility with <option> children.
 */
export const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      label,
      placeholder = "Select an option",
      options,
      value: controlledValue,
      defaultValue = "",
      onChange,
      error,
      helperText,
      searchable,
      clearable = false,
      disabled = false,
      required = false,
      isRequired = false,
      name,
      className,
      triggerClassName,
      size = "md",
      children,
    },
    ref,
  ) => {
    const isControlled = controlledValue !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const currentValue = isControlled ? controlledValue : uncontrolledValue;

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const triggerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Parse options from either `options` prop or `<option>` / `<optgroup>` children
    const resolvedOptions = useMemo<SelectOption[]>(() => {
      if (options && options.length > 0) return options;

      const extracted: SelectOption[] = [];

      const processNode = (node: any, currentGroup?: string) => {
        if (!node) return;
        if (Array.isArray(node)) {
          node.forEach((item) => processNode(item, currentGroup));
          return;
        }
        if (!isValidElement(node)) return;

        const props = (node as ReactElement<any>).props || {};
        const nodeType = (node as ReactElement<any>).type;
        const isOptGroup =
          nodeType === "optgroup" ||
          (Boolean(props.label) && Boolean(props.children) && typeof props.children !== "string");

        if (isOptGroup) {
          const groupLabel = typeof props.label === "string" ? props.label : String(props.label || "");
          Children.forEach(props.children, (child) => processNode(child, groupLabel));
          return;
        }

        const val = props.value !== undefined ? String(props.value) : "";
        let lbl = "";
        if (typeof props.children === "string") {
          lbl = props.children;
        } else if (Array.isArray(props.children)) {
          lbl = props.children.map((c: any) => (typeof c === "string" ? c : "")).join("");
        } else if (props.children) {
          lbl = String(props.children);
        } else {
          lbl = val;
        }

        extracted.push({
          value: val,
          label: lbl,
          group: currentGroup,
          disabled: Boolean(props.disabled),
        });
      };

      Children.forEach(children, (child) => processNode(child));
      return extracted;
    }, [options, children]);

    const isSearchable = searchable ?? resolvedOptions.length > 7;

    // Use floating coordinates with portal
    const coords = useFloatingPosition(triggerRef, isOpen, 280);

    // Selected option display
    const selectedOption = resolvedOptions.find((opt) => opt.value === currentValue);
    const displayLabel = selectedOption ? selectedOption.label : "";

    // Close on outside click (outside trigger AND popover)
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
          setSearchQuery("");
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isOpen) {
          setIsOpen(false);
          setSearchQuery("");
        }
      };
      if (isOpen) {
        window.addEventListener("keydown", handleKeyDown);
      }
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen]);

    // Focus search on open
    useEffect(() => {
      if (isOpen && isSearchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }, [isOpen, isSearchable]);

    const filteredOptions = isSearchable && searchQuery.trim()
      ? resolvedOptions.filter(
          (opt) =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.description?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : resolvedOptions;

    const handleSelect = (val: string) => {
      if (!isControlled) setUncontrolledValue(val);
      onChange?.({ target: { value: val, name } });
      setIsOpen(false);
      setSearchQuery("");
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isControlled) setUncontrolledValue("");
      onChange?.({ target: { value: "", name } });
    };

    return (
      <div className={cn("relative w-full", (label || helperText || error) && "space-y-1.5", className)}>
        {label && (
          <label className="block text-xs font-semibold text-foreground">
            {label}
            {(required || isRequired) && <span className="ml-0.5 text-red-500">*</span>}
          </label>
        )}

        {/* Trigger Button */}
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
            "flex w-full cursor-pointer items-center justify-between border bg-background transition-all duration-150 select-none",
            selectSizeClasses[size],
            "border-zinc-200/90 dark:border-zinc-800",
            "hover:border-zinc-300 dark:hover:border-zinc-700",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
            isOpen && "ring-2 ring-primary border-primary",
            disabled && "cursor-not-allowed opacity-50 hover:border-zinc-200",
            error && "border-red-500 focus-visible:ring-red-500",
            triggerClassName,
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {selectedOption?.icon && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                {selectedOption.icon}
              </span>
            )}
            <span
              className={cn(
                "truncate",
                size === "xs" || size === "sm" ? "text-xs" : "text-sm",
                displayLabel ? "text-foreground font-medium" : "text-muted-foreground/60",
              )}
            >
              {displayLabel || placeholder}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1.5">
            {clearable && displayLabel && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800 transition-colors"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown
              className={cn(
                selectIconSizes[size],
                "text-muted-foreground transition-transform duration-200 shrink-0",
                isOpen && "rotate-180",
              )}
            />
          </div>
        </div>

        {/* Portal Listbox Popover */}
        <PopoverPortal isOpen={isOpen && Boolean(coords)}>
          {coords && (
            <div
              ref={popoverRef}
              style={{
                position: "fixed",
                top: coords.top !== undefined ? `${coords.top}px` : undefined,
                bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
                left: `${coords.left}px`,
                width: coords.width ? `${coords.width}px` : "240px",
                zIndex: 99999,
              }}
              className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-1.5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in-0 zoom-in-95 duration-150"
            >
              {/* Search filter input */}
              {isSearchable && (
                <SearchInput
                  ref={searchInputRef}
                  placeholder="Search options..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-1.5 h-8"
                />
              )}

              {/* Options list */}
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {filteredOptions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    No options found
                  </div>
                ) : (
                  filteredOptions.map((opt, idx) => {
                    const isSelected = opt.value === currentValue;
                    const showGroupHeader = Boolean(
                      opt.group && (idx === 0 || filteredOptions[idx - 1]?.group !== opt.group),
                    );
                    return (
                      <div key={`${opt.value}-${idx}`} className="space-y-0.5">
                        {showGroupHeader && (
                          <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 border-t border-zinc-100 dark:border-zinc-800/80 first:border-0 first:pt-1">
                            {opt.group}
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => handleSelect(opt.value)}
                          className={cn(
                            "group flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-all duration-150 select-none",
                            "hover:bg-accent hover:text-accent-foreground",
                            isSelected && "bg-primary/10 text-primary font-semibold hover:bg-primary/15",
                            opt.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {opt.icon && (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground group-hover:text-foreground">
                                {opt.icon}
                              </span>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{opt.label}</span>
                              {opt.description && (
                                <span className="truncate text-xs text-muted-foreground">
                                  {opt.description}
                                </span>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </PopoverPortal>

        {error && <p className="text-xs text-red-500 leading-tight">{error}</p>}
        {!error && helperText && <p className="text-xs text-muted-foreground leading-tight">{helperText}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";
export const RichSelect = Select;
