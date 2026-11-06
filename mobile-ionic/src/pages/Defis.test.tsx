import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Defis from "./Defis";

describe("Defis Page (Quêtes et Raids)", () => {
  it("renders page title, boss information and contribution", () => {
    render(
      <IonReactRouter>
        <Defis />
      </IonReactRouter>,
    );
    expect(screen.getAllByText("Défis").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Tes sorties te donnent des points/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Titan de la ville")).toBeInTheDocument();
    expect(screen.getByText(/580 000 \/ 1 000 000 PV/i)).toBeInTheDocument();
    expect(screen.getByText(/Ta contribution/i)).toBeInTheDocument();
    expect(screen.getByText("860 points")).toBeInTheDocument();
  });

  it("renders scope filter buttons and nearby quests", () => {
    render(
      <IonReactRouter>
        <Defis />
      </IonReactRouter>,
    );
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("National")).toBeInTheDocument();
    expect(screen.getByText("Mondial")).toBeInTheDocument();

    expect(screen.getByText("Rejoindre le parc")).toBeInTheDocument();
    expect(screen.getByText("Atteindre le monument")).toBeInTheDocument();
    expect(screen.getByText("+80 XP")).toBeInTheDocument();
  });
});
