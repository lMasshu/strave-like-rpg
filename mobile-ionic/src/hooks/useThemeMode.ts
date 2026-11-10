import { useEffect, useState, useCallback } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type ColorPalette =
  | "lime-frost"
  | "violet-bloom"
  | "scarlet-snow";

const THEME_STORAGE_KEY = "stride_theme_preference";
const PALETTE_STORAGE_KEY = "stride_color_palette";

function isColorPalette(value: string | null): value is ColorPalette {
  return (
    value === "lime-frost" ||
    value === "violet-bloom" ||
    value === "scarlet-snow"
  );
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeToDOM(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;

  document.documentElement.setAttribute("data-theme", resolved);
  if (document.body) {
    document.body.setAttribute("data-theme", resolved);
  }

  if (resolved === "dark") {
    document.documentElement.classList.add("ion-palette-dark");
    if (document.body) document.body.classList.add("ion-palette-dark");
  } else {
    document.documentElement.classList.remove("ion-palette-dark");
    if (document.body) document.body.classList.remove("ion-palette-dark");
  }
}

export function useThemeMode() {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof localStorage === "undefined") return "system";
    const saved = localStorage.getItem(
      THEME_STORAGE_KEY,
    ) as ThemePreference | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "system";
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const [palette, setPaletteState] = useState<ColorPalette>(() => {
    if (typeof localStorage === "undefined") return "lime-frost";
    const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
    return isColorPalette(saved) ? saved : "lime-frost";
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-palette", palette);
    if (document.body) document.body.setAttribute("data-palette", palette);
  }, [palette]);

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: ResolvedTheme =
      resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  const setPalette = useCallback((newPalette: ColorPalette) => {
    setPaletteState(newPalette);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PALETTE_STORAGE_KEY, newPalette);
    }
  }, []);

  return {
    theme,
    resolvedTheme,
    palette,
    toggleTheme,
    setTheme,
    setPalette,
  };
}
