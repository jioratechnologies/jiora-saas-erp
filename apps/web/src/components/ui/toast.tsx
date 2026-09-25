import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

import { formatErrorMessage } from "../../lib/error-formatter";

export type ToastVariant = "default" | "primary" | "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, errorOrDesc?: unknown) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let globalToastHandler: ((input: ToastInput) => void) | null = null;

/**
 * Imperative toast function usable anywhere (including outside React components or in event callbacks)
 */
export const toast = {
  show: (input: ToastInput) => globalToastHandler?.(input),
  success: (title: string, description?: string) =>
    globalToastHandler?.({ title, description, variant: "success" }),
  error: (title: string, errorOrDesc?: unknown) =>
    globalToastHandler?.({
      title,
      description: errorOrDesc ? formatErrorMessage(errorOrDesc) : undefined,
      variant: "error",
    }),
  warning: (title: string, description?: string) =>
    globalToastHandler?.({ title, description, variant: "warning" }),
  info: (title: string, description?: string) =>
    globalToastHandler?.({ title, description, variant: "info" }),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((input: ToastInput) => {
    const id = Math.random().toString(36).slice(2, 9);
    const item: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant ?? "default",
      duration: input.duration ?? 4000,
    };
    setToasts((prev) => [...prev.slice(-4), item]); // keep at most 5 toasts
  }, []);

  useEffect(() => {
    globalToastHandler = addToast;
    return () => {
      globalToastHandler = null;
    };
  }, [addToast]);

  const value: ToastContextValue = {
    toast: addToast,
    success: (title, desc) => addToast({ title, description: desc, variant: "success" }),
    error: (title, errOrDesc) =>
      addToast({ title, description: errOrDesc ? formatErrorMessage(errOrDesc) : undefined, variant: "error" }),
    warning: (title, desc) => addToast({ title, description: desc, variant: "warning" }),
    info: (title, desc) => addToast({ title, description: desc, variant: "info" }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            aria-live="polite"
            aria-label="Notifications"
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
          >
            {toasts.map((t) => (
              <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const variantStyles: Record<
    ToastVariant,
    { icon: typeof CheckCircle2; iconColor: string; bgBadge: string }
  > = {
    default: {
      icon: Info,
      iconColor: "text-foreground",
      bgBadge: "bg-muted text-foreground",
    },
    primary: {
      icon: Info,
      iconColor: "text-primary",
      bgBadge: "bg-primary/10 text-primary",
    },
    success: {
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      bgBadge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    error: {
      icon: AlertCircle,
      iconColor: "text-red-500",
      bgBadge: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    warning: {
      icon: AlertTriangle,
      iconColor: "text-amber-500",
      bgBadge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    info: {
      icon: Info,
      iconColor: "text-sky-500",
      bgBadge: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
  };

  const current = variantStyles[toast.variant];
  const IconComponent = current.icon;

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto relative flex w-full items-start gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800",
        "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-4 text-zinc-900 dark:text-zinc-100",
        "shadow-lg shadow-black/5 dark:shadow-black/20",
        "animate-in fade-in slide-in-from-bottom-3 duration-200",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          current.bgBadge,
        )}
      >
        <IconComponent className={cn("h-4 w-4", current.iconColor)} />
      </span>

      <div className="flex-1 pt-0.5">
        <h4 className="text-sm font-semibold leading-snug">{toast.title}</h4>
        {toast.description && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Close notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used within <ToastProvider>");
  return ctx;
}
