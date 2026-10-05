import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary border border-primary/20",
        secondary:
          "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700",
        success:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
        destructive:
          "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
        warning:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
        outline:
          "border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-transparent",
        solid:
          "bg-primary text-primary-foreground shadow-sm shadow-primary/25",
      },
      size: {
        sm: "px-2 py-0.2 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "success" && "bg-emerald-500",
            variant === "destructive" && "bg-red-500",
            variant === "warning" && "bg-amber-500",
            (!variant || variant === "default") && "bg-primary",
            variant === "secondary" && "bg-zinc-500",
          )}
        />
      )}
      {children}
    </span>
  );
}
