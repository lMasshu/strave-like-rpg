import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import LoginPage from "./Login";

describe("LoginPage", () => {
  it("renders login options and slogan in full page view", () => {
    render(
      <IonReactRouter>
        <LoginPage />
      </IonReactRouter>,
    );

    expect(
      screen.getByText(/Transformez chaque sortie en quête épique/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continuer avec Google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Se connecter par Email/i }),
    ).toBeInTheDocument();
  });
});
