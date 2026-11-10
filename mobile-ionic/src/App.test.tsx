import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App tab bar", () => {
  it("marks the current tab active and keeps its Line MD icon", async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const homeTab = container.querySelector('ion-tab-button[tab="accueil"]');
      expect(homeTab).toHaveClass("tab-selected");
    });

    const homeTab = container.querySelector('ion-tab-button[tab="accueil"]');
    expect(homeTab?.querySelector('[data-icon="home"]')).toBeInTheDocument();
  });
});
