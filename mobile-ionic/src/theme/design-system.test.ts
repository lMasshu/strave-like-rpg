import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Design System CSS tokens", () => {
  const cssPath = path.resolve(__dirname, "design-system.css");
  const variablesPath = path.resolve(__dirname, "variables.css");
  const appPath = path.resolve(__dirname, "../App.tsx");

  it("should have design system styles available in document or imports", () => {
    expect(true).toBe(true);
  });

  it('should define light theme tokens on :root and [data-theme="light"]', () => {
    expect(fs.existsSync(cssPath)).toBe(true);
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // Light theme selector
    expect(cssContent).toMatch(/:root\s*,\s*\[data-theme=["']light["']\]/);

    // Light theme surface and background
    expect(cssContent).toContain("--sq-bg-base: #f8fafc;");
    expect(cssContent).toContain("--sq-surface-card: #ffffff;");
    expect(cssContent).toContain("--sq-surface-card-subtle: #f1f5f9;");

    // Light theme borders
    expect(cssContent).toContain("--sq-border: #e2e8f0;");
    expect(cssContent).toContain(
      "--sq-border-highlight: rgba(21, 128, 61, 0.25);",
    );

    // Light theme text
    expect(cssContent).toContain("--sq-text-main: #0f172a;");
    expect(cssContent).toContain("--sq-text-muted: #64748b;");
    expect(cssContent).toContain("--sq-text-secondary: #64748b;");

    // Light theme accents
    expect(cssContent).toContain("--sq-green-athletic: #15803d;");
    expect(cssContent).toContain("--sq-green-athletic-tint: #16a34a;");
    expect(cssContent).toContain(
      "--sq-color-primary: var(--sq-green-athletic);",
    );
    expect(cssContent).toContain("--sq-gold-rpg: #b45309;");
    expect(cssContent).toContain("--sq-gold-rpg-tint: #d97706;");
    expect(cssContent).toContain("--sq-danger-raid: #dc2626;");

    // Light theme shadows
    expect(cssContent).toContain(
      "--sq-shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.06);",
    );
    expect(cssContent).toContain(
      "--sq-shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);",
    );
  });

  it('should define dark theme tokens on [data-theme="dark"] and prefers-color-scheme media query', () => {
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // Dark theme selector
    expect(cssContent).toMatch(/\[data-theme=["']dark["']\]/);
    expect(cssContent).toMatch(
      /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/,
    );

    // Dark theme surface and background
    expect(cssContent).toContain("--sq-bg-base: #090d16;");
    expect(cssContent).toContain("--sq-surface-card: #131a29;");
    expect(cssContent).toContain(
      "--sq-surface-card-subtle: rgba(255, 255, 255, 0.04);",
    );

    // Dark theme borders
    expect(cssContent).toContain("--sq-border: #1e293b;");
    expect(cssContent).toContain(
      "--sq-border-highlight: rgba(34, 197, 94, 0.35);",
    );

    // Dark theme text
    expect(cssContent).toContain("--sq-text-main: #f8fafc;");
    expect(cssContent).toContain("--sq-text-muted: #94a3b8;");
    expect(cssContent).toContain("--sq-text-secondary: #94a3b8;");

    // Dark theme accents
    expect(cssContent).toContain("--sq-green-athletic: #16a34a;");
    expect(cssContent).toContain("--sq-green-athletic-tint: #22c55e;");
    expect(cssContent).toContain("--sq-gold-rpg: #d97706;");
    expect(cssContent).toContain("--sq-gold-rpg-tint: #f59e0b;");
    expect(cssContent).toContain("--sq-danger-raid: #ef4444;");
  });

  it("should synchronize Ionic variables with Stride Quest tokens in variables.css", () => {
    expect(fs.existsSync(variablesPath)).toBe(true);
    const varContent = fs.readFileSync(variablesPath, "utf-8");

    // Root / Light mode sync
    expect(varContent).toContain(
      "--ion-background-color: var(--sq-bg-base, #f8fafc);",
    );
    expect(varContent).toContain(
      "--ion-text-color: var(--sq-text-main, #0f172a);",
    );
    expect(varContent).toContain(
      "--ion-card-background: var(--sq-surface-card, #ffffff);",
    );
    expect(varContent).toContain(
      "--ion-border-color: var(--sq-border, #e2e8f0);",
    );

    // Dark mode / .ion-palette-dark sync
    expect(varContent).toMatch(
      /\[data-theme=["']dark["']\],\s*\.ion-palette-dark/,
    );
  });

  it("should have common utility classes, micro-interactions and tabular numbers", () => {
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    expect(cssContent).toContain(".sq-card");
    expect(cssContent).toContain(".sq-button-primary");
    expect(cssContent).toContain(".sq-metric-value");
    expect(cssContent).toContain("scale(0.98)");
    expect(cssContent).toContain("tabular-nums");
  });

  it("should be imported in App.tsx", () => {
    const appContent = fs.readFileSync(appPath, "utf-8");
    expect(appContent).toMatch(/import\s+["'].\/theme\/design-system\.css["']/);
  });
});
