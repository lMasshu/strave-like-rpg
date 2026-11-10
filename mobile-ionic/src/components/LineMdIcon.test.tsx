import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LineMdIcon from "./LineMdIcon";

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
    expect(icon).toHaveStyle({
      "--line-md-icon-size": "24px",
      color: "currentColor",
    });
  });

  it("rejects icon names that are not embedded", () => {
    // @ts-expect-error unknown-icon is deliberately absent from LineMdIconName.
    render(<LineMdIcon name="unknown-icon" />);
  });
});
