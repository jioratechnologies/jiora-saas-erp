import { forwardRef, createContext, useContext, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import type { ButtonProps } from "./button";

interface ButtonGroupContextType {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  disabled?: boolean;
}

const ButtonGroupContext = createContext<ButtonGroupContextType | null>(null);

export function useButtonGroup() {
  return useContext(ButtonGroupContext);
}

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  orientation?: "horizontal" | "vertical";
  fullWidth?: boolean;
  disabled?: boolean;
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(
  (
    {
      className,
      size,
      variant,
      orientation = "horizontal",
      fullWidth = false,
      disabled = false,
      children,
      ...props
    },
    ref,
  ) => {
    const isHorizontal = orientation === "horizontal";

    return (
      <ButtonGroupContext.Provider value={{ size, variant, disabled }}>
        <div
          ref={ref}
          role="group"
          className={cn(
            "inline-flex",
            isHorizontal ? "flex-row items-center" : "flex-col items-stretch",
            fullWidth && "w-full",
            // Border collapse & corner rounding for child buttons
            isHorizontal && [
              "[&>button]:rounded-none",
              "[&>button:first-child]:rounded-l-xl",
              "[&>button:last-child]:rounded-r-xl",
              "[&>button:only-child]:rounded-xl",
              "[&>button:not(:first-child)]:-ml-px",
            ],
            !isHorizontal && [
              "[&>button]:rounded-none",
              "[&>button:first-child]:rounded-t-xl",
              "[&>button:last-child]:rounded-b-xl",
              "[&>button:only-child]:rounded-xl",
              "[&>button:not(:first-child)]:-mt-px",
            ],
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </ButtonGroupContext.Provider>
    );
  },
);

ButtonGroup.displayName = "ButtonGroup";
