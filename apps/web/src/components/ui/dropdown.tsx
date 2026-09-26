import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
  type HTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";
import { PopoverPortal, useFloatingPosition } from "./popover-portal";

// ─── Dropdown Context ────────────────────────────────────────────────────────

interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  close: () => void;
  triggerRef: React.RefObject<HTMLDivElement>;
}

const DropdownContext = createContext<DropdownContextType | null>(null);

function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("Dropdown compound components must be rendered inside <Dropdown>");
  return ctx;
}

// ─── Dropdown Root ───────────────────────────────────────────────────────────

export interface DropdownProps {
  children: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Dropdown({ children, isOpen: controlledOpen, onOpenChange, className }: DropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const setIsOpen = (nextOpen: boolean) => {
    if (!isControlled) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const close = () => setIsOpen(false);

  // Close on outside click (outside trigger AND menu)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        close();
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Close on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <DropdownContext.Provider value={{ isOpen: open, setIsOpen, close, triggerRef }}>
      <div ref={triggerRef} className={cn("relative inline-block text-left", className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

// ─── DropdownTrigger ─────────────────────────────────────────────────────────

export interface DropdownTriggerProps {
  children: ReactElement;
  className?: string;
}

export function DropdownTrigger({ children, className }: DropdownTriggerProps) {
  const { isOpen, setIsOpen } = useDropdown();

  if (!isValidElement(children)) return null;

  const child = children as ReactElement<HTMLAttributes<HTMLElement>>;

  return cloneElement(child, {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      child.props.onClick?.(e);
      setIsOpen(!isOpen);
    },
    "aria-haspopup": "menu",
    "aria-expanded": isOpen,
    className: cn(child.props.className, className),
  });
}

// ─── DropdownMenu ────────────────────────────────────────────────────────────

export interface DropdownMenuProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  align?: "start" | "end" | "center";
  ariaLabel?: string;
  minWidth?: number;
}

export function DropdownMenu({
  children,
  align = "start",
  ariaLabel = "Menu",
  minWidth = 190,
  className,
  ...props
}: DropdownMenuProps) {
  const { isOpen, triggerRef } = useDropdown();
  const coords = useFloatingPosition(triggerRef, isOpen, 240);

  if (!isOpen || !coords) return null;

  // Adjust left position based on alignment
  let finalLeft = coords.left;
  if (align === "end" && coords.width) {
    finalLeft = Math.max(8, coords.left + coords.width - minWidth);
  } else if (align === "center" && coords.width) {
    finalLeft = Math.max(8, coords.left + coords.width / 2 - minWidth / 2);
  }

  return (
    <PopoverPortal isOpen={isOpen}>
      <div
        role="menu"
        aria-label={ariaLabel}
        style={{
          position: "fixed",
          top: coords.top !== undefined ? `${coords.top}px` : undefined,
          bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
          left: `${finalLeft}px`,
          minWidth: `${minWidth}px`,
          zIndex: 99999,
        }}
        className={cn(
          "overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-1.5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in-0 zoom-in-95 duration-150",
          className,
        )}
        {...props}
      >
        <div className="flex flex-col gap-0.5">{children}</div>
      </div>
    </PopoverPortal>
  );
}

// ─── DropdownSection ─────────────────────────────────────────────────────────

export interface DropdownSectionProps {
  title?: string;
  showDivider?: boolean;
  children: ReactNode;
}

export function DropdownSection({ title, showDivider = false, children }: DropdownSectionProps) {
  return (
    <div className="py-1">
      {title && (
        <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {title}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
      {showDivider && <div className="my-1 h-px bg-zinc-200/80 dark:bg-zinc-800" />}
    </div>
  );
}

// ─── DropdownItem ────────────────────────────────────────────────────────────

export interface DropdownItemProps {
  children: ReactNode;
  icon?: ReactNode;
  description?: string;
  shortcut?: string;
  variant?: "default" | "danger";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function DropdownItem({
  children,
  icon,
  description,
  shortcut,
  variant = "default",
  disabled = false,
  onClick,
  className,
}: DropdownItemProps) {
  const { close } = useDropdown();

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    close();
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        variant === "default" && [
          "text-foreground hover:bg-accent active:bg-accent/80",
          "hover:text-accent-foreground",
        ],
        variant === "danger" && [
          "text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/15",
        ],
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground transition-colors",
              variant === "danger"
                ? "text-red-500"
                : "group-hover:text-foreground",
            )}
          >
            {icon}
          </span>
        )}
        <div className="flex flex-col min-w-0">
          <span className="truncate font-medium">{children}</span>
          {description && (
            <span className="truncate text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </div>
      </div>

      {shortcut && (
        <span className="text-[11px] font-mono tracking-wider text-muted-foreground/60 ml-2">
          {shortcut}
        </span>
      )}
    </button>
  );
}
