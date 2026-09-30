export interface HslColor {
  h: number;
  s: number;
  l: number;
}

/** Converts any hex color ("#1F4E78" or "1F4E78") to HSL values. */
export function hexToHsl(hex: string): HslColor {
  const clean = hex.replace("#", "");
  if (!clean || clean.length < 6) {
    return { h: 209, s: 58, l: 30 }; // Fallback to corporate blue
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Returns space-separated HSL triple ("209 58% 30%").
 * When isDark is true, automatically ensures minimum lightness (58%-65%)
 * so text-primary and badges have crystal clear, vibrant contrast against dark backgrounds.
 */
export function hexToHslTriple(hex: string, isDark = false): string {
  const { h, s, l } = hexToHsl(hex);
  if (isDark) {
    const darkL = Math.max(l, 58);
    const darkS = Math.min(Math.max(s, 50), 92);
    return `${h} ${darkS}% ${darkL}%`;
  }
  const lightL = Math.min(Math.max(l, 25), 45);
  return `${h} ${s}% ${lightL}%`;
}

/**
 * Applies tenant theme CSS variables onto the target element (usually <html>).
 * Updates --primary, --primary-foreground, and --ring dynamically.
 */
export function applyThemeVariables(root: HTMLElement, hex: string, isDark: boolean) {
  if (!hex) return;
  const { h, s, l } = hexToHsl(hex);

  if (isDark) {
    // Dark Mode: Elevated lightness for luminous contrast on dark surfaces
    const darkL = Math.max(l, 58);
    const darkS = Math.min(Math.max(s, 50), 92);
    root.style.setProperty("--primary", `${h} ${darkS}% ${darkL}%`);
    root.style.setProperty("--primary-foreground", darkL > 75 ? "0 0% 0%" : "0 0% 100%");
    root.style.setProperty("--ring", `${h} ${darkS}% ${darkL}%`);
  } else {
    // Light Mode: Rich saturated color for contrast on white surfaces
    const lightL = Math.min(Math.max(l, 25), 45);
    root.style.setProperty("--primary", `${h} ${s}% ${lightL}%`);
    root.style.setProperty("--primary-foreground", "0 0% 100%");
    root.style.setProperty("--ring", `${h} ${s}% ${lightL}%`);
  }
}
