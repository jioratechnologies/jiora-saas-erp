import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Native <input type="checkbox"> under a styled box, not a Radix primitive —
 * this is internal admin tooling, not a consumer product; a native control
 * gets correct keyboard/screen-reader behaviour for free and one fewer
 * dependency to carry. See the note in AppShell.tsx for the same call on Avatar.
 *
 * Uses `has-[:checked]` (Tailwind 3.4+) rather than `peer-checked` — the
 * checkmark icon and the input are true siblings so peer-checked would work
 * for the icon alone, but the outer box's own border/fill also needs to
 * react to its *own descendant* being checked, which peer-checked can't do
 * (peer only looks at preceding siblings, not children).
 */
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <span
      className={cn(
        "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input bg-background transition-colors",
        "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        className,
      )}
    >
      <input type="checkbox" ref={ref} className="peer absolute inset-0 h-4 w-4 cursor-pointer opacity-0" {...props} />
      <Check className="pointer-events-none h-3 w-3 scale-0 text-primary-foreground transition-transform peer-checked:scale-100" />
    </span>
  ),
);
Checkbox.displayName = "Checkbox";
