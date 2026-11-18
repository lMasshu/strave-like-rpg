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
  let getSummaries: ReturnType<typeof vi.spyOn>;
  let getFriends: ReturnType<typeof vi.spyOn>;

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
    getSummaries = vi
      .spyOn(apiClient, "getActivitySummaries")
      .mockResolvedValue([]);
    getFriends = vi.spyOn(apiClient, "getFriends").mockResolvedValue([]);
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

  it("affiche le nom, l'e-mail, le niveau et l'XP du compte connecté", async () => {
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
    // 820 XP : niveau 1, 820 XP sur les 1 000 du niveau
    expect(screen.getByText("820 / 1000 XP")).toBeInTheDocument();
    expect(screen.getByText("Niveau 1")).toBeInTheDocument();
    expect(screen.getByText(/Novice des Sentiers/i)).toBeInTheDocument();
    // Plus de bandeau « Se connecter » ni de déconnexion ici (elle est dans les Paramètres).
    expect(screen.queryByRole("button", { name: /se connecter/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /déconnecter/i })).toBeNull();
    await waitFor(() => expect(getPlayer).toHaveBeenCalled());
    expect(
      screen.getByRole("heading", { name: "Compte_Inscrit" }),
    ).toBeInTheDocument();
  });

  it("les sorties font monter le niveau : 7 000 XP donnent le niveau 8", async () => {
    const account = { ...TEST_PLAYER, level: 8, experience: 7000 };
    getPlayer.mockResolvedValue(account);

    renderProfile(fakeAuth({ player: account }));

    expect(await screen.findByText("Niveau 8")).toBeInTheDocument();
    expect(screen.getByText("0 / 1000 XP")).toBeInTheDocument();
    expect(screen.getByText("1000 XP avant le rang 9")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: "Progression vers le niveau suivant",
      }),
    ).toHaveAttribute("aria-valuenow", "0");
  });

  it("affiche le nombre d'amis enregistrés en base", async () => {
    const friend = {
      id: "f-1",
      username: "test",
      level: 8,
      experience: 7000,
      createdAt: "2026-11-17T00:00:00.000Z",
    };
    getFriends.mockResolvedValue([friend]);
    renderProfile();

    expect(await screen.findByText("1 compagnon")).toBeInTheDocument();
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
    ).toHaveTextContent(/Distance par jour/);
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

  it("calcule les statistiques de la semaine en cours à partir des vraies sorties", async () => {
    const today = new Date();
    const thisWeekRun = {
      ...REAL_RUN,
      startedAt: today.toISOString(),
      distanceMeters: 6500,
      elevationGainMeters: 80,
    };
    getActivities.mockResolvedValue([thisWeekRun]);
    getSummaries.mockResolvedValue([thisWeekRun]);

    renderProfile();

    expect(
      await screen.findByRole("heading", { name: "Statistiques" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText("Distance").closest(".sq-stat-metric"),
      ).toHaveTextContent("6.5km"),
    );
    expect(
      screen.getByText("Dénivelé").closest(".sq-stat-metric"),
    ).toHaveTextContent("80m D+");
    expect(screen.queryByText(/Quêtes réussies/i)).toBeNull();

    // La semaine en cours est demandée à l'API (lundi 00:00 → lundi suivant).
    const [from, to] = getSummaries.mock.calls[0] as [Date, Date];
    expect(from.getDay()).toBe(1);
    expect(from.getHours()).toBe(0);
    expect(to.getTime() - from.getTime()).toBeGreaterThanOrEqual(
      7 * 24 * 3600 * 1000 - 3600 * 1000, // changement d'heure
    );
  });

  it("recharge les statistiques quand on choisit le mois ou l'année", async () => {
    getActivities.mockResolvedValue([REAL_RUN]);

    renderProfile();
    await screen.findByRole("heading", { name: "Statistiques" });
    await waitFor(() => expect(getSummaries).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Année" }));

    await waitFor(() => expect(getSummaries).toHaveBeenCalledTimes(2));
    const [from, to] = getSummaries.mock.calls[1] as [Date, Date];
    expect([from.getMonth(), from.getDate()]).toEqual([0, 1]);
    expect(to.getFullYear()).toBe(from.getFullYear() + 1);
    expect(
      screen.getByRole("list", { name: "Distance par mois" }),
    ).toBeInTheDocument();
  });

  it("sans aucune sortie : vraies statistiques à zéro, historique vide", async () => {
    renderProfile();
    await waitFor(() => expect(getSummaries).toHaveBeenCalled());

    // Le compte n'a pas de sortie : on n'invente pas de chiffres.
    expect(
      screen.getByRole("heading", { name: "Statistiques" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Aucune sortie sur cette période."),
    ).toBeInTheDocument();
    expect(screen.queryByText("218.4")).toBeNull();

    openTab(/Activités/);
    expect(
      await screen.findByText("Aucune sortie enregistrée pour l'instant."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mode Démo/i)).toBeNull();
    expect(screen.queryByText(/Reconnaissance des Remparts/i)).toBeNull();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
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

  it("ne propose plus de basculer vers des données de démo", async () => {
    getActivities.mockResolvedValue([REAL_RUN]);

    renderProfile();
    openTab(/Activités/);

    expect(await screen.findByText(/Course d'endurance/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /voir démo/i })).toBeNull();
    expect(screen.queryByText(/Reconnaissance des Remparts/i)).toBeNull();
  });
});
