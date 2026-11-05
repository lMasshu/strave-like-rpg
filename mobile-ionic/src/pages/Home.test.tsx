import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Home from "./Home";

describe("Home Page (Maquette Page 1)", () => {
  it("renders the greeting, level badge and big start workout hero", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Prêt à bouger \?/i)).toBeInTheDocument();
    expect(screen.getByText(/Démarrer une sortie/i)).toBeInTheDocument();
    expect(screen.getByText(/Enregistrement en un geste/i)).toBeInTheDocument();
    expect(screen.getByText(/N7/i)).toBeInTheDocument();
  });

  it("renders weekly athletic stats, last activity and active raid boss", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Cette semaine/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Dernière sortie • Course à pied/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Boss en cours/i)).toBeInTheDocument();
    expect(screen.getByText(/58 %/i)).toBeInTheDocument();
  });
});
