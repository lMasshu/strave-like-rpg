import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("App settings route", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/parametres");
  });

  it("renders settings and hides the main tab bar", async () => {
    const { container } = render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Paramètres" }),
    ).toBeInTheDocument();
    expect(container.querySelector("ion-tab-bar")).toHaveClass(
      "tab-bar-hidden",
    );
  });
});
