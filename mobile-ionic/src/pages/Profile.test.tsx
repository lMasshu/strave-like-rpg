import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Profile from "./Profile";

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
  });

  it("shows cloud sync banner and connect button when guest, and user details when authenticated", () => {
    // 1. Invité
    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );
    expect(
      screen.getByText(/Sauvegardez votre progression dans le cloud/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Se connecter" }),
    ).toBeInTheDocument();
  });

  it("loads and displays real activities from the API when available", async () => {
    const { apiClient } = await import("../services/apiClient");
    const getActivitiesSpy = vi
      .spyOn(apiClient, "getPlayerActivities")
      .mockResolvedValue([
        {
          id: "real-act-1",
          playerId: "player-default-001",
          activityType: "run",
          startedAt: "2026-11-17T08:00:00.000Z",
          endedAt: "2026-11-17T08:35:00.000Z",
          durationSeconds: 2100,
          distanceMeters: 6500,
          elevationGainMeters: 80,
          coordinates: [],
          createdAt: "2026-11-17T08:35:00.000Z",
        },
      ]);
    const getPlayerSpy = vi
      .spyOn(apiClient, "getCurrentPlayer")
      .mockResolvedValue({
        id: "player-default-001",
        username: "Alexis_Runner",
        level: 4,
        experience: 3500,
        createdAt: "2026-11-01T00:00:00.000Z",
      });

    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );

    // Wait for the async activity to appear
    expect(await screen.findByText(/Course d'endurance/i)).toBeInTheDocument();
    expect(screen.getByText(/6.5 km/i)).toBeInTheDocument();
    expect(screen.getByText(/1 réelle/i)).toBeInTheDocument();

    getActivitiesSpy.mockRestore();
    getPlayerSpy.mockRestore();
  });

  it("toggles between real activities and demo data without crashing", async () => {
    const { apiClient } = await import("../services/apiClient");
    const getActivitiesSpy = vi
      .spyOn(apiClient, "getPlayerActivities")
      .mockResolvedValue([
        {
          id: "real-act-1",
          playerId: "player-default-001",
          activityType: "run",
          startedAt: "2026-11-17T08:00:00.000Z",
          endedAt: "2026-11-17T08:35:00.000Z",
          durationSeconds: 2100,
          distanceMeters: 6500,
          elevationGainMeters: 80,
          coordinates: [],
          createdAt: "2026-11-17T08:35:00.000Z",
        },
      ]);

    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );

    // Initialement les activités réelles sont affichées
    expect(await screen.findByText(/Course d'endurance/i)).toBeInTheDocument();
    const toggleBtn = screen.getByRole("button", { name: /voir démo/i });
    expect(toggleBtn).toBeInTheDocument();

    // Clic pour passer en mode démo
    fireEvent.click(toggleBtn);

    // Vérifie que les données de démo s'affichent sans crash (pas de page blanche)
    expect(
      screen.getByText(/Reconnaissance des Remparts/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /voir mes sorties/i }),
    ).toBeInTheDocument();

    // Clic pour revenir aux vraies sorties
    fireEvent.click(screen.getByRole("button", { name: /voir mes sorties/i }));
    expect(screen.getByText(/Course d'endurance/i)).toBeInTheDocument();

    getActivitiesSpy.mockRestore();
  });
});
