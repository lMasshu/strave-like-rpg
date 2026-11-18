import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProfileStatsPanel, { ProfileStatsPanelProps } from "./ProfileStatsPanel";
import type { SportType, StatsActivity } from "../services/activityStats";

const local = (y: number, m: number, d: number, h = 0) =>
  new Date(y, m - 1, d, h);
// Mardi 17 novembre 2026
const NOW = local(2026, 11, 17, 15);

const activity = (
  start: Date,
  km: number,
  dPlus: number,
  minutes: number,
  activityType: SportType = "run",
): StatsActivity => ({
  startedAt: start.toISOString(),
  activityType,
  distanceMeters: km * 1000,
  elevationGainMeters: dPlus,
  durationSeconds: minutes * 60,
});

function renderPanel(props: Partial<ProfileStatsPanelProps> = {}) {
  const onPeriodChange = vi.fn();
  render(
    <ProfileStatsPanel
      period="week"
      onPeriodChange={onPeriodChange}
      activities={[]}
      loading={false}
      error={null}
      now={NOW}
      sports={[]}
      {...props}
    />,
  );
  return onPeriodChange;
}

function metric(label: string): HTMLElement {
  return screen.getByText(label).closest(".sq-stat-metric") as HTMLElement;
}

describe("ProfileStatsPanel", () => {
  it("affiche les totaux de la semaine calculés à partir des activités", () => {
    renderPanel({
      activities: [
        activity(local(2026, 11, 16, 7), 10.35, 40, 61),
        activity(local(2026, 11, 17, 18), 5.2, 1200, 30),
      ],
    });

    expect(screen.getByText("Du 16 au 22 novembre")).toBeInTheDocument();
    expect(metric("Distance")).toHaveTextContent("15.6km");
    expect(metric("Dénivelé")).toHaveTextContent("1 240m D+");
    expect(metric("Sorties")).toHaveTextContent("2sorties");
    expect(metric("Temps actif")).toHaveTextContent("1 h 31");
    expect(screen.queryByText(/Aucune sortie/)).toBeNull();

    const chart = screen.getByRole("list", { name: "Distance par jour" });
    expect(within(chart).getAllByRole("listitem")).toHaveLength(7);
    expect(
      within(chart).getByRole("listitem", { name: "Lun : 10.4 km" }),
    ).toBeInTheDocument();
    expect(
      within(chart).getByRole("listitem", { name: "Mar : 5.2 km" }),
    ).toBeInTheDocument();
  });

  it("propose semaine, mois et année et signale la période choisie", () => {
    const onPeriodChange = renderPanel({ period: "month" });

    const group = screen.getByRole("group", {
      name: "Période des statistiques",
    });
    expect(within(group).getByRole("button", { name: "Mois" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(group).getByRole("button", { name: "Semaine" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("novembre 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Distance par semaine" }),
    ).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("button", { name: "Année" }));
    expect(onPeriodChange).toHaveBeenCalledWith("year");
  });

  it("vue année : 12 mois", () => {
    renderPanel({
      period: "year",
      activities: [activity(local(2026, 3, 2), 8, 0, 45)],
    });

    const chart = screen.getByRole("list", { name: "Distance par mois" });
    expect(within(chart).getAllByRole("listitem")).toHaveLength(12);
    expect(
      within(chart).getByRole("listitem", { name: "Mar : 8 km" }),
    ).toBeInTheDocument();
    expect(metric("Sorties")).toHaveTextContent("1sortie");
  });

  it("affiche des zéros et un message sans sortie sur la période", () => {
    renderPanel();

    expect(metric("Distance")).toHaveTextContent("0km");
    expect(metric("Temps actif")).toHaveTextContent("0 min");
    expect(
      screen.getByText("Aucune sortie sur cette période."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Enregistre une première sortie/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Sport affiché" })).toBeNull();
  });

  it("affiche l'erreur de chargement sans le message « aucune sortie »", () => {
    renderPanel({ error: "Impossible de charger les statistiques." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Impossible de charger les statistiques.",
    );
    expect(screen.queryByText(/Aucune sortie/)).toBeNull();
  });

  it("distance par sport : un onglet par sport pratiqué, graphique filtré", () => {
    renderPanel({
      sports: ["run", "bike"],
      activities: [
        activity(local(2026, 11, 16, 7), 10, 0, 60, "run"),
        activity(local(2026, 11, 17, 9), 42, 300, 90, "bike"),
      ],
    });

    const group = screen.getByRole("group", { name: "Sport affiché" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Course", "Vélo"]);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");

    const runChart = screen.getByRole("list", {
      name: "Distance par jour – Course",
    });
    expect(
      within(runChart).getByRole("listitem", { name: "Lun : 10 km" }),
    ).toBeInTheDocument();
    expect(
      within(runChart).getByRole("listitem", { name: "Mar : 0 km" }),
    ).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("button", { name: "Vélo" }));
    const bikeChart = screen.getByRole("list", {
      name: "Distance par jour – Vélo",
    });
    expect(
      within(bikeChart).getByRole("listitem", { name: "Mar : 42 km" }),
    ).toBeInTheDocument();
    expect(
      within(bikeChart).getByRole("listitem", { name: "Lun : 0 km" }),
    ).toBeInTheDocument();
  });

  it("distance par sport : suit la période choisie", () => {
    renderPanel({
      period: "year",
      sports: ["walk"],
      activities: [activity(local(2026, 3, 2), 6, 0, 70, "walk")],
    });

    const chart = screen.getByRole("list", {
      name: "Distance par mois – Marche",
    });
    expect(within(chart).getAllByRole("listitem")).toHaveLength(12);
    expect(
      within(chart).getByRole("listitem", { name: "Mar : 6 km" }),
    ).toBeInTheDocument();
  });

  it("toutes les barres sont des données ; seule la période en cours est marquée", () => {
    renderPanel({
      activities: [activity(local(2026, 11, 16, 7), 10, 0, 60)],
    });

    const chart = screen.getByRole("list", { name: "Distance par jour" });
    const monday = within(chart).getByRole("listitem", { name: "Lun : 10 km" });
    const tuesday = within(chart).getByRole("listitem", { name: "Mar : 0 km" });
    expect(monday).toHaveClass("sq-stats-bar");
    expect(monday).not.toHaveClass("is-current");
    expect(tuesday).toHaveClass("is-current");
  });
});
