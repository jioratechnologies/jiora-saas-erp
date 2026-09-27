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
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {(stats as HeaderStatItem[]).map((s, idx) => (
            <div
              key={idx}
              className="rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 px-3 py-1.5 shadow-2xs"
            >
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {s.label}
              </div>
              <div className={cn("text-base font-bold text-foreground mt-0.5", s.color)}>
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
          "rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-4 sm:p-4.5 mb-4 shadow-xs transition-all",
          sticky && "sticky top-16 z-20 shadow-sm",
          className
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                <Icon className="h-4.5 w-4.5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                  {title}
                </h1>
                {renderBadge()}
              </div>
              {description && (
                <p className="text-xs text-muted-foreground line-clamp-1">
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
          <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
            {renderStats()}
          </div>
        )}
      </div>
    </>
  );
}
