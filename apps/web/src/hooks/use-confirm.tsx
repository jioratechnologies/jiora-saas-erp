import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" (red confirm button, warning icon) for delete/deactivate/suspend — the default. "default" for anything reversible-but-worth-a-pause. */
  variant?: "destructive" | "default";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Global confirm-before-you-do-it dialog, styled to match the rest of the
 * app instead of the browser's native `confirm()`. Any component calls
 * `useConfirm()` and `await`s the result — no dialog JSX to render per
 * call site, no per-page open/close state to manage.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>();

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    setOptions(null);
  };

  useEffect(() => {
    if (!options) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resolver.current?.(false);
        setOptions(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
              onClick={() => close(false)}
              aria-hidden="true"
            />
            {/* Solid Dialog Card */}
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-zinc-900 dark:text-zinc-50 shadow-2xl shadow-black/25 animate-in zoom-in-95 slide-in-from-bottom-2 duration-150"
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    options.variant === "default"
                      ? "bg-primary/10 text-primary"
                      : "bg-red-500/10 text-red-600 dark:text-red-400",
                  )}
                >
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="pt-0.5">
                  <h2 id="confirm-title" className="text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
                    {options.title}
                  </h2>
                  {options.description && (
                    <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {options.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium px-4 h-9 active:scale-[0.98] transition-transform"
                  onClick={() => close(false)}
                >
                  {options.cancelLabel ?? "Cancel"}
                </Button>
                <Button
                  variant={options.variant === "default" ? "default" : "destructive"}
                  size="sm"
                  className={cn(
                    "rounded-xl font-medium px-4 h-9 active:scale-[0.98] transition-transform",
                    options.variant !== "default" && "bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/25",
                  )}
                  onClick={() => close(true)}
                  autoFocus
                >
                  {options.confirmLabel ?? "Confirm"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm() must be used within <ConfirmProvider>");
  return ctx;
}
