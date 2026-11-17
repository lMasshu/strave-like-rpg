import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ProfileTabs, { ProfileTab } from "./ProfileTabs";

type TabId = "stats" | "activities" | "achievements";

const TABS: ProfileTab<TabId>[] = [
  { id: "stats", label: "Statistiques", icon: "" },
  { id: "activities", label: "Activités", icon: "" },
  { id: "achievements", label: "Accomplissements", icon: "" },
];

function Harness({ onChange }: { onChange?: (tab: TabId) => void }) {
  const [active, setActive] = useState<TabId>("stats");
  return (
    <ProfileTabs
      tabs={TABS}
      activeTab={active}
      idPrefix="test"
      label="Sections du profil"
      onChange={(tab) => {
        setActive(tab);
        onChange?.(tab);
      }}
    />
  );
}

describe("ProfileTabs", () => {
  it("expose une liste d'onglets reliée aux panneaux", () => {
    render(<Harness />);

    expect(
      screen.getByRole("tablist", { name: "Sections du profil" }),
    ).toBeInTheDocument();
    const stats = screen.getByRole("tab", { name: "Statistiques" });
    expect(stats).toHaveAttribute("aria-selected", "true");
    expect(stats).toHaveAttribute("aria-controls", "test-panel-stats");
    expect(stats).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Activités" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("n'affiche le nom que sous l'onglet actif, sans le retirer aux lecteurs d'écran", () => {
    render(<Harness />);

    expect(screen.getByText("Statistiques")).not.toHaveClass(
      "sq-visually-hidden",
    );
    expect(screen.getByText("Activités")).toHaveClass("sq-visually-hidden");
    expect(screen.getByRole("tab", { name: "Activités" })).toHaveAttribute(
      "title",
      "Activités",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Activités" }));

    expect(screen.getByText("Activités")).not.toHaveClass("sq-visually-hidden");
    expect(screen.getByText("Statistiques")).toHaveClass("sq-visually-hidden");
  });

  it("change d'onglet au clic", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Accomplissements" }));

    expect(onChange).toHaveBeenCalledWith("achievements");
    expect(
      screen.getByRole("tab", { name: "Accomplissements" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("navigue aux flèches en bouclant, et avec Début / Fin", () => {
    render(<Harness />);
    const stats = screen.getByRole("tab", { name: "Statistiques" });

    fireEvent.keyDown(stats, { key: "ArrowLeft" });
    const last = screen.getByRole("tab", { name: "Accomplissements" });
    expect(last).toHaveAttribute("aria-selected", "true");
    expect(last).toHaveFocus();

    fireEvent.keyDown(last, { key: "ArrowRight" });
    expect(stats).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(stats, { key: "End" });
    expect(last).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(last, { key: "Home" });
    expect(stats).toHaveAttribute("aria-selected", "true");
  });

  it("ignore les autres touches", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Statistiques" }), {
      key: "a",
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
