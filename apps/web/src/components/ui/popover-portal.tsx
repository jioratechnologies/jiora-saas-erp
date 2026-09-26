import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface FloatingCoords {
  top?: number;
  bottom?: number;
  left: number;
  width?: number;
  maxHeight?: number;
  openUp: boolean;
}

export function useFloatingPosition(
  triggerRef: React.RefObject<HTMLElement>,
  isOpen: boolean,
  popoverHeight = 320,
) {
  const [coords, setCoords] = useState<FloatingCoords | null>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Open upward if there is not enough space below AND more space above
      const openUp = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

      let left = rect.left;
      // Guard right edge overflow
      if (left + 300 > viewportWidth) {
        left = Math.max(12, viewportWidth - 312);
      }

      setCoords({
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? viewportHeight - rect.top + 6 : undefined,
        left: Math.max(8, left),
        width: rect.width,
        openUp,
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, triggerRef, popoverHeight]);

  return coords;
}

export function PopoverPortal({
  children,
  isOpen,
}: {
  children: ReactNode;
  isOpen: boolean;
}) {
  if (!isOpen || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
