import { render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import LineMdIcon, { LINE_MD_ICON_NAMES } from "./LineMdIcon";

describe("LineMdIcon", () => {
  it("hides a decorative icon from assistive technologies", () => {
    const { container } = render(<LineMdIcon name="home" />);

    const icon = container.querySelector('[data-icon="home"]');
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).not.toHaveAttribute("role");
  });

  it("exposes a labelled icon as an image", () => {
    render(<LineMdIcon name="map-marker" label="Position actuelle" />);

    expect(
      screen.getByRole("img", { name: "Position actuelle" }),
    ).toBeInTheDocument();
  });

  it("preserves Ionic slots, custom classes and explicit sizes", () => {
    const { container } = render(
      <LineMdIcon
        name="account-add"
        slot="icon-only"
        className="toolbar-icon"
        size={24}
      />,
    );

    const icon = container.querySelector('[data-icon="account-add"]');
    expect(icon).toHaveClass("line-md-icon", "toolbar-icon");
    expect(icon).toHaveAttribute("slot", "icon-only");
    expect(icon).toHaveStyle({ "--line-md-icon-size": "24px" });
    expect((icon as HTMLElement).style.color).toBe("");
  });

  it("lets the surrounding CSS choose the icon colour", () => {
    const { container } = render(
      <LineMdIcon name="home" style={{ color: "rgb(1, 2, 3)" }} />,
    );

    const icon = container.querySelector('[data-icon="home"]');
    expect(icon).toHaveStyle({ color: "rgb(1, 2, 3)" });
  });

  it("mirrors Ionic slot geometry for span-based icons", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/components/LineMdIcon.css"),
      "utf8",
    );

    expect(css).toMatch(/ion-button\s+\.line-md-icon\[slot="start"\]/);
    expect(css).toMatch(/ion-button\s+\.line-md-icon\[slot="icon-only"\]/);
    expect(css).toMatch(/ion-tab-button\s+\.line-md-icon/);
  });

  it("ships a non-empty local SVG for every declared icon name", () => {
    for (const name of LINE_MD_ICON_NAMES) {
      const iconPath = resolve(
        process.cwd(),
        "public/icons/line-md",
        `${name}.svg`,
      );
      expect(existsSync(iconPath), `${name}.svg is missing`).toBe(true);

      const svg = readFileSync(iconPath, "utf8");
      expect(svg).toContain("<svg");
      expect(svg).toMatch(/viewBox="0 0 24 24"/);
      expect(svg, `${name}.svg must not animate`).not.toMatch(
        /<animate\b|<animateTransform\b|<set\b/,
      );
      expect(svg, `${name}.svg must not hide content`).not.toMatch(
        /opacity="0"/,
      );

      for (const match of svg.matchAll(/stroke-dashoffset="([^"]+)"/g)) {
        expect(match[1], `${name}.svg has a hidden stroke`).toBe("0");
      }
    }
  });

  it("rejects icon names that are not embedded", () => {
    // @ts-expect-error unknown-icon is deliberately absent from LineMdIconName.
    render(<LineMdIcon name="unknown-icon" />);
  });
});
