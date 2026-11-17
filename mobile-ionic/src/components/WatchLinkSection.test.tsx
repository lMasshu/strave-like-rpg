import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WatchLinkStatus, WatchWorkout } from "../data/watchLink";
import WatchLinkSection, { WatchLinkSectionProps } from "./WatchLinkSection";

const linked: WatchLinkStatus = {
  state: "linked",
  platform: "android",
  heartRateAuthorized: true,
};

const run: WatchWorkout = {
  externalId: "hc-run-1",
  activityType: "run",
  startedAt: "2026-11-16T07:00:00.000Z",
  endedAt: "2026-11-16T07:30:00.000Z",
  durationSeconds: 1800,
  distanceMeters: 5012,
  caloriesKcal: 410,
  sourceName: "Garmin Connect",
};

function renderSection(props: Partial<WatchLinkSectionProps> = {}) {
  const handlers = {
    onLink: vi.fn(),
    onRefresh: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  render(
    <WatchLinkSection
      status={null}
      workouts={[]}
      isBusy={false}
      error={null}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("WatchLinkSection", () => {
  it("explique que la liaison est réservée à l'appli mobile dans le navigateur", () => {
    renderSection({
      status: {
        state: "unavailable",
        platform: "web",
        heartRateAuthorized: false,
      },
    });

    expect(
      screen.getByRole("heading", { name: "Montres connectées" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/uniquement dans l’appli mobile/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("invite à installer Health Connect quand il manque sur Android", () => {
    renderSection({
      status: {
        state: "unavailable",
        platform: "android",
        heartRateAuthorized: false,
      },
    });

    expect(
      screen.getByText(/Health Connect est introuvable/),
    ).toBeInTheDocument();
  });

  it("propose de connecter la montre quand elle n'est pas liée", () => {
    const { onLink } = renderSection({
      status: {
        state: "not-linked",
        platform: "android",
        heartRateAuthorized: false,
      },
    });

    expect(screen.getByRole("status")).toHaveTextContent("Non connectée");
    fireEvent.click(
      screen.getByRole("button", { name: "Connecter ma montre" }),
    );
    expect(onLink).toHaveBeenCalledTimes(1);
  });

  it("liste les séances détectées une fois liée", () => {
    const { onRefresh, onOpenSettings } = renderSection({
      status: linked,
      workouts: [run],
    });

    expect(screen.getByRole("status")).toHaveTextContent("Connectée");
    const list = screen.getByRole("list", { name: "Séances de la montre" });
    expect(list).toHaveTextContent("Course");
    expect(list).toHaveTextContent("Garmin Connect");
    expect(list).toHaveTextContent("5,01 km · 30 min");

    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Gérer dans Health Connect" }),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("indique quand aucune séance n'a été trouvée", () => {
    renderSection({ status: linked, workouts: [] });
    expect(screen.getByText(/Aucune course, marche/)).toBeInTheDocument();
  });

  it("affiche les erreurs et désactive les actions pendant le chargement", () => {
    renderSection({
      status: { ...linked, state: "not-linked" },
      isBusy: true,
      error: "Impossible de lire Health Connect.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Impossible de lire Health Connect.",
    );
    expect(
      screen.getByRole("button", { name: "Connecter ma montre" }),
    ).toBeDisabled();
  });
});
