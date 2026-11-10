import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import TopBar from "./TopBar";

describe("TopBar Component", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/accueil");
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders app title and navigation buttons", async () => {
    render(
      <IonReactRouter>
        <TopBar title="Test Title" />
      </IonReactRouter>,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByLabelText(/Trouver des amis/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notifications/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Paramètres"));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/parametres");
    });
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
