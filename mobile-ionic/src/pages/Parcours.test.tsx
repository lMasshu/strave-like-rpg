import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Parcours from "./Parcours";

describe("Parcours Page (Bibliothèque de parcours)", () => {
  it("renders page header and filter chips", () => {
    render(
      <IonReactRouter>
        <Parcours />
      </IonReactRouter>,
    );
    expect(
      screen.getAllByText(/Bibliothèque de parcours/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Près de moi")).toBeInTheDocument();
    expect(screen.getByText("Course")).toBeInTheDocument();
    expect(screen.getByText("Vélo")).toBeInTheDocument();
  });

  it("renders public routes with author and distance", () => {
    render(
      <IonReactRouter>
        <Parcours />
      </IonReactRouter>,
    );
    expect(screen.getByText("Boucle du parc")).toBeInTheDocument();
    expect(screen.getByText("Le long des quais")).toBeInTheDocument();
    expect(screen.getByText(/Publié par Léa/i)).toBeInTheDocument();
    expect(screen.getByText(/Publié par Hugo/i)).toBeInTheDocument();
  });
});
