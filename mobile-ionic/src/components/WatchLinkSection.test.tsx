import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WatchLinkStatus } from "../data/watchLink";
import WatchLinkSection, { WatchLinkSectionProps } from "./WatchLinkSection";

const linked: WatchLinkStatus = {
  state: "linked",
  platform: "android",
  heartRateAuthorized: true,
};

function renderSection(props: Partial<WatchLinkSectionProps> = {}) {
  const handlers = {
    onLink: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  render(
    <WatchLinkSection
      status={null}
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

  it("une fois liée, renvoie vers l'historique du profil sans lister les séances", () => {
    const { onOpenSettings } = renderSection({ status: linked });

    expect(screen.getByRole("status")).toHaveTextContent("Connectée");
    expect(
      screen.getByText(/apparaissent dans l’historique des activités/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connecter ma montre" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Gérer dans Health Connect" }),
    );
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
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
