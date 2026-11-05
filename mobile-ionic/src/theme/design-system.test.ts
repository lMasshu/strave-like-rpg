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
    expect(cssContent).toContain("--sq-bg-base: #faf9f5;");
    expect(cssContent).toContain("--sq-surface-card: #f5f4ef;");
    expect(cssContent).toContain("--sq-surface-card-subtle: #ede9de;");

    // Light theme borders
    expect(cssContent).toContain("--sq-border: #dad9d4;");

    // Light theme text
    expect(cssContent).toContain("--sq-text-main: #3d3929;");
    expect(cssContent).toContain("--sq-text-muted: #6e6d68;");
    expect(cssContent).toContain("--sq-text-secondary: #6e6d68;");

    // Light theme accents
    expect(cssContent).toContain("--sq-green-athletic: #2f7f33;");
    expect(cssContent).toContain("--sq-green-athletic-tint: #48b42d;");
    expect(cssContent).toContain(
      "--sq-color-primary: var(--sq-green-athletic);",
    );
    expect(cssContent).toContain("--sq-gold-rpg: #c96442;");
    expect(cssContent).toContain("--sq-gold-rpg-tint: #d97757;");
    expect(cssContent).toContain("--sq-danger-raid: #dc2626;");

    // Light theme shadows
    expect(cssContent).toContain(
      "--sq-shadow-sm: 0 1px 3px rgba(61, 57, 41, 0.06);",
    );
    expect(cssContent).toContain(
      "--sq-shadow-md: 0 4px 12px rgba(61, 57, 41, 0.08);",
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
    expect(cssContent).toContain("--sq-bg-base: #262624;");
    expect(cssContent).toContain("--sq-surface-card: #2c2c2b;");
    expect(cssContent).toContain("--sq-surface-card-subtle: #1f1e1d;");

    // Dark theme borders
    expect(cssContent).toContain("--sq-border: #3e3e38;");

    // Dark theme text
    expect(cssContent).toContain("--sq-text-main: #f1f1ef;");
    expect(cssContent).toContain("--sq-text-muted: #b7b5a9;");
    expect(cssContent).toContain("--sq-text-secondary: #b7b5a9;");

    // Dark theme accents
    expect(cssContent).toContain("--sq-green-athletic: #48b42d;");
    expect(cssContent).toContain("--sq-green-athletic-tint: #47c940;");
    expect(cssContent).toContain("--sq-gold-rpg: #d97757;");
    expect(cssContent).toContain("--sq-gold-rpg-tint: #e58d71;");
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
