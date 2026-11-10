import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useThemeMode } from "./useThemeMode";

describe("useThemeMode hook", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-palette");
    document.body.removeAttribute("data-palette");
    document.documentElement.classList.remove("ion-palette-dark");
  });

  it("uses Lime Frost when no valid palette preference exists", () => {
    localStorage.setItem("stride_color_palette", "unknown-palette");

    const { result } = renderHook(() => useThemeMode());

    expect(result.current.palette).toBe("lime-frost");
    expect(document.documentElement.getAttribute("data-palette")).toBe(
      "lime-frost",
    );
    expect(document.body.getAttribute("data-palette")).toBe("lime-frost");
  });

  it("restores and persists a supported color palette", () => {
    localStorage.setItem("stride_color_palette", "violet-bloom");
    const { result } = renderHook(() => useThemeMode());

    expect(result.current.palette).toBe("violet-bloom");

    act(() => {
      result.current.setPalette("scarlet-snow");
    });

    expect(result.current.palette).toBe("scarlet-snow");
    expect(localStorage.getItem("stride_color_palette")).toBe(
      "scarlet-snow",
    );
    expect(document.documentElement.getAttribute("data-palette")).toBe(
      "scarlet-snow",
    );
  });

  it("keeps palette and appearance preferences independent", () => {
    const { result } = renderHook(() => useThemeMode());

    act(() => {
      result.current.setPalette("violet-bloom");
      result.current.setTheme("dark");
    });

    expect(result.current.palette).toBe("violet-bloom");
    expect(result.current.resolvedTheme).toBe("dark");
    expect(localStorage.getItem("stride_color_palette")).toBe(
      "violet-bloom",
    );
    expect(localStorage.getItem("stride_theme_preference")).toBe("dark");
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
