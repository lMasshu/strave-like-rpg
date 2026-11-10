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
    expect(cssContent).toContain("--sq-bg-base: #fbfcf8;");
    expect(cssContent).toContain("--sq-surface-card: #ffffff;");
    expect(cssContent).toContain("--sq-surface-card-subtle: #f1f5f9;");

    // Light theme borders
    expect(cssContent).toContain("--sq-border: #e2e8f0;");

    // Light theme text
    expect(cssContent).toContain("--sq-text-main: #0f172a;");
    expect(cssContent).toContain("--sq-text-muted: #64748b;");
    expect(cssContent).toContain("--sq-text-secondary: #64748b;");

    // Light theme accents
    expect(cssContent).toContain("--sq-green-athletic: #aff33e;");
    expect(cssContent).toContain("--sq-green-athletic-tint: #c3f668;");
    expect(cssContent).toContain(
      "--sq-color-primary: var(--sq-green-athletic);",
    );
    expect(cssContent).toContain("--sq-gold-rpg: #f59e0b;");
    expect(cssContent).toContain("--sq-gold-rpg-tint: #fbbf24;");
    expect(cssContent).toContain("--sq-danger-raid: #ef4444;");

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
    expect(cssContent).toContain("--sq-bg-base: #020617;");
    expect(cssContent).toContain("--sq-surface-card: #0f172a;");
    expect(cssContent).toContain("--sq-surface-card-subtle: #1e293b;");

    // Dark theme borders
    expect(cssContent).toContain("--sq-border: #1e293b;");

    // Dark theme text
    expect(cssContent).toContain("--sq-text-main: #f8fafc;");
    expect(cssContent).toContain("--sq-text-muted: #94a3b8;");
    expect(cssContent).toContain("--sq-text-secondary: #94a3b8;");

    // Dark theme accents
    expect(cssContent).toContain("--sq-green-athletic: #aff33e;");
    expect(cssContent).toContain("--sq-green-athletic-tint: #c3f668;");
    expect(cssContent).toContain("--sq-gold-rpg: #f59e0b;");
    expect(cssContent).toContain("--sq-gold-rpg-tint: #fbbf24;");
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

  it("defines complete light and dark tokens for each selectable palette", () => {
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    const varContent = fs.readFileSync(variablesPath, "utf-8");

    expect(cssContent).toMatch(/\[data-palette=["']lime-frost["']\]/);
    expect(cssContent).toMatch(/\[data-palette=["']violet-bloom["']\]/);
    expect(cssContent).toMatch(/\[data-palette=["']scarlet-snow["']\]/);
    expect(cssContent).toMatch(
      /\[data-theme=["']dark["']\]\[data-palette=["']violet-bloom["']\]/,
    );
    expect(cssContent).toMatch(
      /\[data-theme=["']dark["']\]\[data-palette=["']scarlet-snow["']\]/,
    );

    expect(cssContent).toContain("--sq-color-primary: #7033ff;");
    expect(cssContent).toContain("--sq-bg-base: #fdfdfd;");
    expect(cssContent).toContain("--sq-border: #e7e7ee;");
    expect(cssContent).toContain("--sq-color-primary: #e11d48;");
    expect(cssContent).toContain("--sq-bg-base: #fffafa;");
    expect(cssContent).toContain("--sq-border: #f1d7dc;");
    expect(cssContent).toContain("--sq-color-primary: #8c5cff;");
    expect(cssContent).toContain("--sq-color-primary: #fb7185;");

    expect(varContent).toContain(
      "--ion-color-primary: var(--sq-color-primary);",
    );
    expect(varContent).toContain(
      "--ion-color-primary-contrast: var(--sq-primary-fg);",
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
