import type { Config } from "tailwindcss";

/**
 * Colors are CSS variables (--primary etc.), not fixed Tailwind palette
 * values, because they're overridden per-tenant at runtime by ThemeProvider
 * (src/theme/ThemeProvider.tsx) — this is what makes white-labelling work
 * without a rebuild. See docs/adr/0008-theming-css-variables.md.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
      },
    },
  },
  plugins: [],
} satisfies Config;
