import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Profile from "./Profile";
import { apiClient, ActivityDto } from "../services/apiClient";
import { fakeAuth, TEST_PLAYER, withAuth } from "../test/authTestUtils";

const { importWatchWorkouts } = vi.hoisted(() => ({
  importWatchWorkouts: vi.fn(),
}));
vi.mock("../services/watchSync", () => ({ importWatchWorkouts }));

const REAL_RUN: ActivityDto = {
  id: "real-act-1",
  playerId: TEST_PLAYER.id,
  activityType: "run",
  startedAt: "2026-11-17T08:00:00.000Z",
  endedAt: "2026-11-17T08:35:00.000Z",
  durationSeconds: 2100,
  distanceMeters: 6500,
  elevationGainMeters: 80,
  coordinates: [],
  createdAt: "2026-11-17T08:35:00.000Z",
};

function renderProfile(auth = fakeAuth()) {
  return render(<IonReactRouter>{withAuth(<Profile />, auth)}</IonReactRouter>);
}

function openTab(name: RegExp) {
  fireEvent.click(screen.getByRole("tab", { name }));
}

describe("Profile Page (Adventurer Card)", () => {
  let getActivities: ReturnType<typeof vi.spyOn>;
  let getPlayer: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    importWatchWorkouts.mockReset();
    importWatchWorkouts.mockResolvedValue({
      state: "skipped",
      imported: 0,
      ignored: 0,
      failed: 0,
    });
    getActivities = vi
      .spyOn(apiClient, "getPlayerActivities")
      .mockResolvedValue([]);
    getPlayer = vi
      .spyOn(apiClient, "getCurrentPlayer")
      .mockResolvedValue(TEST_PLAYER);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("importe les séances de la montre du joueur connecté avant de relire l'historique", async () => {
    const calls: string[] = [];
    importWatchWorkouts.mockImplementation(async () => {
      calls.push("import");
      return { state: "synced", imported: 1, ignored: 0, failed: 0 };
    });
    getActivities.mockImplementation(async () => {
      calls.push("activities");
      return [];
    });

    renderProfile();

    await waitFor(() => expect(calls).toContain("activities"));
    expect(calls.indexOf("import")).toBeLessThan(calls.indexOf("activities"));
    expect(importWatchWorkouts).toHaveBeenCalledWith(TEST_PLAYER.id);
  });

  it("affiche quand même le profil si l'import de la montre échoue", async () => {
    importWatchWorkouts.mockRejectedValue(new Error("Health Connect absent"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    renderProfile();

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        "Synchronisation de la montre impossible :",
        expect.any(Error),
      ),
    );
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("affiche le nom et l'e-mail du compte connecté, avec niveau et XP de démo", async () => {
    const account = {
      ...TEST_PLAYER,
      username: "Compte_Inscrit",
      email: "inscrit@example.com",
    };
    getPlayer.mockResolvedValue(account);

    renderProfile(fakeAuth({ player: account }));

    expect(
      screen.getByRole("heading", { name: "Compte_Inscrit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("inscrit@example.com")).toBeInTheDocument();
    // Valeurs de démo conservées pour l'instant
    expect(screen.getByText(/820 \/ 1200 XP/i)).toBeInTheDocument();
    expect(screen.getByText(/Éclaireur des Sentiers/i)).toBeInTheDocument();
    // Plus de bandeau « Se connecter » ni de déconnexion ici (elle est dans les Paramètres).
    expect(screen.queryByRole("button", { name: /se connecter/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /déconnecter/i })).toBeNull();
    await waitFor(() => expect(getPlayer).toHaveBeenCalled());
    expect(
      screen.getByRole("heading", { name: "Compte_Inscrit" }),
    ).toBeInTheDocument();
  });

  it("organise le profil en trois onglets sous la fiche, Statistiques par défaut", () => {
    renderProfile();
    expect(
      screen.getByRole("tablist", { name: "Sections du profil" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Statistiques/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tabpanel", { name: /Statistiques/ }),
    ).toHaveTextContent(/Distance par semaine/);
    expect(screen.queryByText(/Historique des sorties/i)).toBeNull();
    expect(screen.queryByText(/Pionnier 10K/i)).toBeNull();

    openTab(/Activités/);
    expect(screen.getByText(/Historique des sorties/i)).toBeInTheDocument();
    expect(screen.queryByText(/Distance totale/i)).toBeNull();

    openTab(/Accomplissements/);
    expect(
      screen.getByRole("heading", { name: /Accomplissements & Trophées/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Historique des sorties/i)).toBeNull();
  });

  it("calcule les statistiques à partir des vraies sorties", async () => {
    getActivities.mockResolvedValue([REAL_RUN]);

    renderProfile();

    expect(await screen.findByText("6.5")).toBeInTheDocument();
    expect(screen.getByText(/Distance totale/i)).toBeInTheDocument();
    expect(screen.getByText(/Dénivelé cumulé/i)).toBeInTheDocument();
    expect(screen.getByText(/Sorties totales/i)).toBeInTheDocument();
    expect(screen.getByText(/Quêtes réussies/i)).toBeInTheDocument();
  });

  it("garde les statistiques et l'historique de démo tant qu'il n'y a pas de vraie sortie", async () => {
    renderProfile();
    await waitFor(() => expect(getActivities).toHaveBeenCalled());

    expect(screen.getByText("218.4")).toBeInTheDocument();
    expect(screen.getByText("1 450")).toBeInTheDocument();

    openTab(/Activités/);
    expect(screen.getByText(/Mode Démo/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Reconnaissance des Remparts/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/\+420 XP/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Badge débloqué : Arpenteur Sylvestre/i),
    ).toBeInTheDocument();
  });

  it("renders badge shelf with unlocked and locked trophies", () => {
    renderProfile();
    openTab(/Accomplissements/);
    expect(screen.getByText(/Pionnier 10K/i)).toBeInTheDocument();
    expect(screen.getByText(/Pourfendeur de Boss/i)).toBeInTheDocument();
    expect(screen.getByText("Arpenteur Sylvestre")).toBeInTheDocument();
    expect(screen.getByText(/Conquérant des Cimes/i)).toBeInTheDocument();
  });

  it("loads and displays real activities from the API when available", async () => {
    getActivities.mockResolvedValue([REAL_RUN]);

    renderProfile();

    openTab(/Activités/);
    expect(await screen.findByText(/Course d'endurance/i)).toBeInTheDocument();
    expect(screen.getByText(/6.5 km/i)).toBeInTheDocument();
    expect(screen.getByText(/1 réelle/i)).toBeInTheDocument();
  });

  it("mélange téléphone et montres, la plus récente en haut, avec la provenance à côté de la date", async () => {
    getActivities.mockResolvedValue([
      // Ordre volontairement mélangé : l'affichage ne doit pas en dépendre.
      {
        ...REAL_RUN,
        id: "old-phone",
        startedAt: "2026-11-10T07:00:00.000Z",
      },
      {
        ...REAL_RUN,
        id: "garmin",
        activityType: "walk",
        startedAt: "2026-11-16T07:00:00.000Z",
        external: {
          source: "health-connect",
          id: "hc-1",
          deviceName: "Garmin Forerunner 255",
        },
      },
      {
        ...REAL_RUN,
        id: "new-phone",
        activityType: "bike",
        startedAt: "2026-11-17T18:00:00.000Z",
      },
      {
        ...REAL_RUN,
        id: "unknown-watch",
        activityType: "hike",
        startedAt: "2026-11-12T07:00:00.000Z",
        external: { source: "health-connect", id: "hc-2" },
      },
    ]);

    renderProfile();
    openTab(/Activités/);

    await screen.findByText(/4 réelles/i);
    const sources = screen
      .getAllByLabelText(/^Enregistrée via /)
      .map((el) => el.getAttribute("aria-label"));
    expect(sources).toEqual([
      "Enregistrée via Téléphone",
      "Enregistrée via Garmin Forerunner 255",
      "Enregistrée via Montre connectée",
      "Enregistrée via Téléphone",
    ]);
    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual([
      "Sortie vélo",
      "Marche active",
      "Quête d'exploration",
      "Course d'endurance",
    ]);
  });

  it("n'indique pas de provenance sur les sorties de démo", async () => {
    renderProfile();
    openTab(/Activités/);
    await waitFor(() => expect(getActivities).toHaveBeenCalled());

    expect(screen.queryAllByLabelText(/^Enregistrée via /)).toHaveLength(0);
  });

  it("toggles between real activities and demo data without crashing", async () => {
    getActivities.mockResolvedValue([REAL_RUN]);

    renderProfile();

    openTab(/Activités/);
    expect(await screen.findByText(/Course d'endurance/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /voir démo/i }));
    expect(
      screen.getByText(/Reconnaissance des Remparts/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /voir mes sorties/i }));
    expect(screen.getByText(/Course d'endurance/i)).toBeInTheDocument();
  });
});
