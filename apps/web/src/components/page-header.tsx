import type { ReactNode, ComponentType } from "react";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { HeaderActionPortal } from "./header-action-portal";

export interface HeaderStatItem {
  label: string;
  value: string | number;
  color?: string;
}

export interface HeaderBadgeObj {
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  actions?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  badge?: ReactNode | HeaderBadgeObj;
  stats?: ReactNode | HeaderStatItem[];
  sticky?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  actions,
  icon: Icon,
  badge,
  stats,
  sticky = true,
  className,
}: PageHeaderProps) {
  const renderedAction = action || actions;

  const renderBadge = () => {
    if (!badge) return null;
    if (typeof badge === "object" && badge !== null && "label" in badge) {
      const b = badge as HeaderBadgeObj;
      return (
        <Badge variant={b.variant || "secondary"} className={cn("text-[11px] font-medium", b.className)}>
          {b.label}
        </Badge>
      );
    }
    return badge as ReactNode;
  };

  const renderStats = () => {
    if (!stats) return null;
    if (Array.isArray(stats)) {
      const items = stats as HeaderStatItem[];
      const gridCols =
        items.length === 4
          ? "grid-cols-4"
          : items.length === 3
            ? "grid-cols-3"
            : "grid-cols-2 sm:grid-cols-4";

      return (
        <div className={cn("grid gap-1 sm:gap-2.5", gridCols)}>
          {items.map((s, idx) => (
            <div
              key={idx}
              className="rounded-lg sm:rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 px-1.5 sm:px-3 py-1 sm:py-1.5 shadow-2xs min-w-0"
            >
              <div className="text-[8px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                {s.label}
              </div>
              <div className={cn("text-xs sm:text-base font-bold text-foreground mt-0.5 truncate", s.color)}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return stats as ReactNode;
  };

  return (
    <>
      {/* Teleport primary actions into Desktop Top Header Bar */}
      {renderedAction && (
        <HeaderActionPortal>
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {renderedAction}
          </div>
        </HeaderActionPortal>
      )}

      {/* Streamlined In-Page Header */}
      <div
        className={cn(
          "rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-3 sm:p-4 mb-2.5 sm:mb-4 shadow-xs transition-all",
          sticky && "sticky top-0 md:top-14 z-20 shadow-sm",
          className
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {Icon && (
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate">
                  {title}
                </h1>
                {renderBadge()}
              </div>
              {description && (
                <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                  {description}
                </p>
              )}
            </div>
          </div>

          {renderedAction && (
            <div className="flex lg:hidden items-center gap-2 flex-wrap shrink-0">
              {renderedAction}
            </div>
          )}
        </div>

        {stats && (
          <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
            {renderStats()}
          </div>
        )}
      </div>
    </>
  );
}
