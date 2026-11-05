import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Home from "./Home";

describe("Home Page (Adventure Dashboard)", () => {
  it("renders the adventure greeting and daily quest hero action", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Quête du jour/i)).toBeInTheDocument();
    expect(screen.getByText(/Démarrer la sortie/i)).toBeInTheDocument();
  });

  it("renders weekly athletic stats and active community raid", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Raid en cours/i)).toBeInTheDocument();
    expect(screen.getByText(/Cette semaine/i)).toBeInTheDocument();
  });

  it("renders recommended daily quest details and XP reward", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Boucle des Trois Moulins/i)).toBeInTheDocument();
    expect(screen.getByText(/\+350 XP/i)).toBeInTheDocument();
    expect(screen.getByText(/6.2 km/i)).toBeInTheDocument();
    expect(screen.getByText(/~40 min/i)).toBeInTheDocument();
  });

  it("renders user greeting and adventurer rank", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Bonjour, Alexis/i)).toBeInTheDocument();
    expect(screen.getByText(/Niveau 7/i)).toBeInTheDocument();
  });

  it("renders active community raid details and handles join action", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Gorgone des Marais/i)).toBeInTheDocument();
    expect(screen.getByText(/Bassin de la Somme/i)).toBeInTheDocument();

    const joinButton = screen.getByRole("button", {
      name: /Participer au Raid/i,
    });
    expect(joinButton).toBeInTheDocument();
    fireEvent.click(joinButton);
  });

  it("renders weekly athletic metrics correctly", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText("28.4")).toBeInTheDocument();
    expect(screen.getByText("2h45")).toBeInTheDocument();
    expect(screen.getByText("230")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders recent expeditions section with activity history and unlocked badges", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Dernières expéditions/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Reconnaissance des Remparts/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Frappe de Raid matinale/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Randonnée d'exploration POI/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Badge débloqué : Arpenteur Sylvestre/i),
    ).toBeInTheDocument();
  });
});
