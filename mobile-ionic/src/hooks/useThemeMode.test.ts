import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useThemeMode } from "./useThemeMode";

describe("useThemeMode hook", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("ion-palette-dark");
  });

  it("defaults to resolved theme and toggles between light and dark", () => {
    const { result } = renderHook(() => useThemeMode());
    expect(["light", "dark"]).toContain(result.current.resolvedTheme);

    const initialTheme = result.current.resolvedTheme;
    act(() => {
      result.current.toggleTheme();
    });

    const nextTheme = result.current.resolvedTheme;
    expect(nextTheme).not.toBe(initialTheme);
    expect(localStorage.getItem("stride_theme_preference")).toBe(nextTheme);
    expect(document.documentElement.getAttribute("data-theme")).toBe(nextTheme);
  });

  it("allows explicitly setting theme", () => {
    const { result } = renderHook(() => useThemeMode());

    act(() => {
      result.current.setTheme("dark");
    });
    expect(result.current.resolvedTheme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(
      document.documentElement.classList.contains("ion-palette-dark"),
    ).toBe(true);

    act(() => {
      result.current.setTheme("light");
    });
    expect(result.current.resolvedTheme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(
      document.documentElement.classList.contains("ion-palette-dark"),
    ).toBe(false);
  });
});
