import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Profile from "./Profile";
import { getActivityIcon, getBadgeIcon } from "../components/lineMdMappings";

describe("Profile Page (Adventurer Card)", () => {
  it("renders user level, xp progress, and adventurer title", () => {
    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Niveau/i)).toBeInTheDocument();
    expect(screen.getAllByText(/XP/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/820 \/ 1200 XP/i)).toBeInTheDocument();
    expect(screen.getByText(/Éclaireur des Sentiers/i)).toBeInTheDocument();
  });

  it("renders the badge shelf and activity history", () => {
    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Accomplissements/i)).toBeInTheDocument();
    expect(screen.getByText(/Historique des sorties/i)).toBeInTheDocument();
  });

  it("renders lifetime training and exploration stats", () => {
    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Distance totale/i)).toBeInTheDocument();
    expect(screen.getByText(/Dénivelé cumulé/i)).toBeInTheDocument();
    expect(screen.getByText(/Sorties totales/i)).toBeInTheDocument();
    expect(screen.getByText(/Quêtes réussies/i)).toBeInTheDocument();
    expect(screen.getByText("218.4")).toBeInTheDocument();
    expect(screen.getByText("1 450")).toBeInTheDocument();
  });

  it("renders badge shelf with unlocked and locked trophies", () => {
    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Pionnier 10K/i)).toBeInTheDocument();
    expect(screen.getByText(/Pourfendeur de Boss/i)).toBeInTheDocument();
    expect(screen.getByText("Arpenteur Sylvestre")).toBeInTheDocument();
    expect(screen.getByText(/Conquérant des Cimes/i)).toBeInTheDocument();
  });

  it("falls back to valid icons for unknown badge and activity values", () => {
    expect(getBadgeIcon("unknown-outline")).toBe("star");
    expect(getActivityIcon("unknown" as never)).toBe("speed");
  });

  it("renders activity history with expedition details and xp", () => {
    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );
    expect(
      screen.getByText(/Reconnaissance des Remparts/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Frappe de Raid matinale/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Randonnée d'exploration POI/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/\+420 XP/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Badge débloqué : Arpenteur Sylvestre/i),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-icon="compass"]')).toBeInTheDocument();
    expect(document.querySelector('[data-icon="speed"]')).toBeInTheDocument();
  });
});
