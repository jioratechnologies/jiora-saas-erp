import React, { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarRadius = "full" | "lg" | "md" | "sm" | "none";
export type AvatarColor = "default" | "primary" | "secondary" | "success" | "warning" | "danger";
export type AvatarStatus = "online" | "offline" | "busy" | "away";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name?: string;
  src?: string;
  size?: AvatarSize;
  radius?: AvatarRadius;
  color?: AvatarColor;
  isBordered?: boolean;
  status?: AvatarStatus;
  fallbackIcon?: React.ReactNode;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: { container: "h-6 w-6", text: "text-[10px]", status: "h-1.5 w-1.5 bottom-0 right-0" },
  sm: { container: "h-8 w-8", text: "text-xs font-semibold", status: "h-2 w-2 bottom-0 right-0" },
  md: { container: "h-10 w-10", text: "text-sm font-semibold", status: "h-2.5 w-2.5 bottom-0 right-0" },
  lg: { container: "h-12 w-12", text: "text-base font-semibold", status: "h-3 w-3 bottom-0.5 right-0.5" },
  xl: { container: "h-14 w-14", text: "text-lg font-semibold", status: "h-3.5 w-3.5 bottom-0.5 right-0.5" },
};

const radiusClasses: Record<AvatarRadius, string> = {
  full: "rounded-full",
  lg: "rounded-2xl",
  md: "rounded-xl",
  sm: "rounded-lg",
  none: "rounded-none",
};

const colorRings: Record<AvatarColor, string> = {
  default: "ring-zinc-300 dark:ring-zinc-700",
  primary: "ring-primary",
  secondary: "ring-secondary-foreground/20",
  success: "ring-emerald-500",
  warning: "ring-amber-500",
  danger: "ring-red-500",
};

const statusColors: Record<AvatarStatus, { bg: string; ping?: boolean }> = {
  online: { bg: "bg-emerald-500", ping: true },
  offline: { bg: "bg-zinc-400 dark:bg-zinc-500" },
  busy: { bg: "bg-red-500" },
  away: { bg: "bg-amber-500" },
};

// Deterministic vibrant palettes for initials
const namePalettes = [
  "bg-gradient-to-br from-indigo-500 to-purple-600 text-white",
  "bg-gradient-to-br from-blue-500 to-cyan-600 text-white",
  "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
  "bg-gradient-to-br from-rose-500 to-pink-600 text-white",
  "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
  "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white",
  "bg-gradient-to-br from-sky-500 to-blue-600 text-white",
];

function getPaletteForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % namePalettes.length;
  return namePalettes[index];
}

/**
 * Avatar with bordered rings, smooth corner radius,
 * fallback initials, gradient hues, and status indicators.
 */
export function Avatar({
  name = "",
  src,
  size = "sm",
  radius = "full",
  color = "primary",
  isBordered = false,
  status,
  className,
  ...props
}: AvatarProps) {
  const [imageFailed, setImageFailed] = React.useState(false);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const sizeStyle = sizeClasses[size];
  const radiusStyle = radiusClasses[radius];

  const palette = name ? getPaletteForName(name) : "bg-primary text-primary-foreground";

  return (
    <div className={cn("relative inline-flex shrink-0", sizeStyle.container, className)}>
      <span
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden transition-all duration-200 select-none shadow-sm",
          radiusStyle,
          isBordered && cn("ring-2 ring-offset-2 ring-offset-background", colorRings[color]),
          !src || imageFailed ? palette : "bg-muted",
          sizeStyle.text,
        )}
        {...props}
      >
        {src && !imageFailed ? (
          <img
            src={src}
            alt={name || "avatar"}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          initials || "?"
        )}
      </span>

      {status && (
        <span
          className={cn(
            "absolute rounded-full border-2 border-background",
            sizeStyle.status,
            statusColors[status].bg,
          )}
        >
          {statusColors[status].ping && (
            <span
              className={cn(
                "absolute -inset-0.5 rounded-full animate-ping opacity-75",
                statusColors[status].bg,
              )}
            />
          )}
        </span>
      )}
    </div>
  );
}

export interface UserProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  description?: string;
  avatarProps?: AvatarProps;
}

/**
 * User compound component combining avatar with user metadata.
 */
export function User({ name, description, avatarProps, className, ...props }: UserProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)} {...props}>
      <Avatar name={name} {...avatarProps} />
      <div className="flex flex-col text-left">
        <span className="text-sm font-semibold leading-tight text-foreground">{name}</span>
        {description && (
          <span className="text-xs text-muted-foreground leading-tight">{description}</span>
        )}
      </div>
    </div>
  );
}
