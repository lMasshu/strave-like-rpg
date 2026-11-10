import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import TopBar from "./TopBar";

describe("TopBar Component", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders app title and navigation buttons", () => {
    render(
      <IonReactRouter>
        <TopBar title="Test Title" />
      </IonReactRouter>,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByLabelText(/Trouver des amis/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notifications/i)).toBeInTheDocument();
  });

  it("renders theme toggle button and toggles theme on click", () => {
    render(
      <IonReactRouter>
        <TopBar />
      </IonReactRouter>,
    );

    const themeButton = screen.getByLabelText(/Activer le mode/i);
    expect(themeButton).toBeInTheDocument();

    fireEvent.click(themeButton);
    expect(localStorage.getItem("stride_theme_preference")).toBeTruthy();
  });
});
