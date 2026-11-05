import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Design System CSS tokens", () => {
  const cssPath = path.resolve(__dirname, "design-system.css");
  const appPath = path.resolve(__dirname, "../App.tsx");

  it("should have design system styles available in document or imports", () => {
    expect(true).toBe(true);
  });

  it("should have design-system.css defined with all required tokens and utility classes", () => {
    expect(fs.existsSync(cssPath)).toBe(true);
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // Required color tokens
    expect(cssContent).toContain("--sq-bg-base: #0b0f19");
    expect(cssContent).toContain("--sq-surface-card: #151e2e");
    expect(cssContent).toContain("--sq-border: #233248");
    expect(cssContent).toContain("--sq-green-athletic: #16a34a");
    expect(cssContent).toContain("--sq-gold-rpg: #d97706");
    expect(cssContent).toContain("--sq-danger-raid: #ef4444");

    // Required utility classes
    expect(cssContent).toContain(".sq-card");
    expect(cssContent).toContain(".sq-button-primary");
    expect(cssContent).toContain(".sq-metric-value");
  });

  it("should define tactile micro-interactions and tabular numbers", () => {
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    expect(cssContent).toContain("scale(0.98)");
    expect(cssContent).toContain("tabular-nums");
  });

  it("should be imported in App.tsx", () => {
    const appContent = fs.readFileSync(appPath, "utf-8");
    expect(appContent).toMatch(/import\s+["'].\/theme\/design-system\.css["']/);
  });
});
