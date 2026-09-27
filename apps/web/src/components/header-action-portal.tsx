import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function HeaderActionPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("appshell-header-actions");
    setTarget(el);
  }, []);

  if (!target) return null;
  return createPortal(children, target);
}
