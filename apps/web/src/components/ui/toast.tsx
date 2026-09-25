import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle, AlertCircle, Info, X, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  createdAt: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  add: (variant: ToastVariant, title: string, description?: string) => void;
  remove: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastContext must be used inside <ToastProvider>");
  return ctx;
}

// ─── Individual Toast Item ────────────────────────────────────────────────────

const ICONS: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertCircle,
};

const ICON_COLORS: Record<ToastVariant, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  info: "text-blue-500",
  warning: "text-amber-500",
};

const BORDER_COLORS: Record<ToastVariant, string> = {
  success: "border-l-emerald-500",
  error: "border-l-red-500",
  info: "border-l-blue-500",
  warning: "border-l-amber-500",
};

const AUTO_DISMISS_MS = 5000;

// ─── Stacked Toast Container ──────────────────────────────────────────────────

const MAX_VISIBLE = 3;

function ToastStack({ toasts, remove }: { toasts: ToastItem[]; remove: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const startTimer = useCallback(
    (id: string) => {
      if (timerRefs.current.has(id)) return;
      const t = setTimeout(() => {
        remove(id);
        timerRefs.current.delete(id);
      }, AUTO_DISMISS_MS);
      timerRefs.current.set(id, t);
    },
    [remove],
  );

  const clearTimer = useCallback((id: string) => {
    const t = timerRefs.current.get(id);
    if (t) {
      clearTimeout(t);
      timerRefs.current.delete(id);
    }
  }, []);

  useEffect(() => {
    if (hovered) {
      // Pause all timers when hovered
      toasts.forEach((t) => clearTimer(t.id));
    } else {
      // Restart timers when not hovered
      toasts.forEach((t) => startTimer(t.id));
    }
  }, [hovered, toasts, startTimer, clearTimer]);

  useEffect(() => {
    // Auto-start timers for new toasts
    toasts.forEach((t) => {
      if (!hovered) startTimer(t.id);
    });
    return () => {
      // Cleanup timers for removed toasts
      const ids = new Set(toasts.map((t) => t.id));
      for (const [id] of timerRefs.current) {
        if (!ids.has(id)) clearTimer(id);
      }
    };
  }, [toasts, hovered, startTimer, clearTimer]);

  if (toasts.length === 0) return null;

  const collapsed = !hovered && toasts.length > 1;
  const visibleToasts = hovered ? toasts : toasts.slice(-MAX_VISIBLE);

  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Expand hint shown when collapsed and multiple toasts */}
      {collapsed && toasts.length > 1 && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-2.5 py-1 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          <ChevronDown className="h-3 w-3" />
          {toasts.length} notifications — hover to expand
        </div>
      )}

      {/* Toast stack */}
      <div
        className={cn(
          "relative flex flex-col items-end transition-all duration-300 ease-in-out",
          collapsed ? "gap-0" : "gap-2.5",
        )}
        style={
          collapsed
            ? {
                // Stack effect: shift each card slightly
                height: `${64 + (Math.min(toasts.length, MAX_VISIBLE) - 1) * 8}px`,
              }
            : undefined
        }
      >
        {visibleToasts.map((toast, i) => {
          const reverseIndex = collapsed ? visibleToasts.length - 1 - i : 0;
          const Icon = ICONS[toast.variant];

          return (
            <div
              key={toast.id}
              className={cn(
                "w-[360px] overflow-hidden rounded-2xl border border-l-4 bg-white dark:bg-zinc-900 shadow-xl shadow-black/10 transition-all duration-300 ease-in-out",
                BORDER_COLORS[toast.variant],
                collapsed && "absolute bottom-0 animate-in fade-in-0",
              )}
              style={
                collapsed
                  ? {
                      transform: `translateY(-${reverseIndex * 8}px) scale(${1 - reverseIndex * 0.03})`,
                      transformOrigin: "bottom right",
                      zIndex: visibleToasts.length - reverseIndex,
                      opacity: 1 - reverseIndex * 0.15,
                    }
                  : {
                      animationDuration: "200ms",
                    }
              }
            >
              {/* Progress bar */}
              <div
                className={cn(
                  "h-0.5 w-full origin-left",
                  toast.variant === "success" && "bg-emerald-500",
                  toast.variant === "error" && "bg-red-500",
                  toast.variant === "info" && "bg-blue-500",
                  toast.variant === "warning" && "bg-amber-500",
                )}
                style={{
                  animation: hovered ? "none" : `shrink ${AUTO_DISMISS_MS}ms linear forwards`,
                }}
              />

              <div className="flex items-start gap-3 px-4 py-3.5">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_COLORS[toast.variant])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground leading-tight">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{toast.description}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    clearTimer(toast.id);
                    remove(toast.id);
                  }}
                  className="mt-0.5 shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((variant: ToastVariant, title: string, description?: string) => {
    setToasts((prev) => {
      // Deduplicate: skip if same variant+title was added within last 2s
      const now = Date.now();
      const isDupe = prev.some(
        (t) => t.variant === variant && t.title === title && now - t.createdAt < 2000,
      );
      if (isDupe) return prev;
      const id = `${now}-${Math.random().toString(36).slice(2)}`;
      return [...prev, { id, variant, title, description, createdAt: now }];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, add, remove }}>
      {children}
      <ToastStack toasts={toasts} remove={remove} />
    </ToastContext.Provider>
  );
}

// ─── Public toast API (singleton-style) ──────────────────────────────────────
// Call toast.success / toast.error / toast.info from anywhere

let _add: ToastContextValue["add"] | null = null;

/** Internal bridge component — mount once inside <ToastProvider> */
export function ToastBridge() {
  const ctx = useToastContext();
  useEffect(() => {
    _add = ctx.add;
    return () => { _add = null; };
  }, [ctx.add]);
  return null;
}

function ensureAdd(variant: ToastVariant, title: string, description?: string) {
  if (_add) {
    _add(variant, title, description);
  } else {
    // Fallback — should never happen if ToastProvider is mounted
    console.warn(`[toast.${variant}]`, title, description);
  }
}

export const toast = {
  success: (title: string, description?: string) => ensureAdd("success", title, description),
  error: (title: string, description?: string) => ensureAdd("error", title, description),
  info: (title: string, description?: string) => ensureAdd("info", title, description),
  warning: (title: string, description?: string) => ensureAdd("warning", title, description),
};

