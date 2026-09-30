import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { useAuthStore } from "../auth/auth-store";
import { hexToHslTriple, applyThemeVariables } from "./hex-to-hsl";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Manages:
 * 1. Dark & Light color modes (system, light, dark with localStorage persistence)
 * 2. Tenant branding primary color CSS variables on <html> (white-labelling)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("saas_erp_theme");
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    }
    return "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("saas_erp_theme");
      if (stored === "light" || stored === "dark") return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("saas_erp_theme", mode);
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // Sync dark class, data-theme, and colorScheme on <html>
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const isDark = theme === "dark" || (theme === "system" && mediaQuery.matches);
      const active = isDark ? "dark" : "light";
      setResolvedTheme(active);

      if (isDark) {
        root.classList.add("dark");
        root.classList.remove("light");
        root.setAttribute("data-theme", "dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
        root.setAttribute("data-theme", "light");
        root.style.colorScheme = "light";
      }
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [theme]);

  // Tenant branding white-labeling
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = Boolean(user);

  // Apply cached primary color immediately to avoid flicker
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("saas_erp_org_color");
      if (cached) {
        applyThemeVariables(document.documentElement, cached, resolvedTheme === "dark");
      }
    }
  }, [resolvedTheme]);

  const { data: org } = useQuery({
    queryKey: ["org", "theme"],
    queryFn: () => api.get<Tenant>("/admin/org"),
    enabled: isLoggedIn,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const root = document.documentElement;
    const color =
      org?.primaryColor || (typeof window !== "undefined" ? localStorage.getItem("saas_erp_org_color") : null);

    if (color) {
      applyThemeVariables(root, color, resolvedTheme === "dark");
      localStorage.setItem("saas_erp_org_color", color);
    } else if (!isLoggedIn) {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
      localStorage.removeItem("saas_erp_org_color");
    }
  }, [org?.primaryColor, isLoggedIn, resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
