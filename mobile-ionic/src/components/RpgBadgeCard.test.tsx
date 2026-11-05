import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RpgBadgeCard from "./RpgBadgeCard";

describe("RpgBadgeCard Component", () => {
  it("displays unlocked badge correctly", () => {
    render(
      <RpgBadgeCard
        name="Pionnier 10K"
        description="Parcourir 10km en une sortie"
        icon="ribbon-outline"
        unlocked={true}
        unlockedAt="12 Oct 2026"
      />,
    );
    expect(screen.getByText("Pionnier 10K")).toBeInTheDocument();
    expect(
      screen.getByText("Parcourir 10km en une sortie"),
    ).toBeInTheDocument();
    expect(screen.getByText("12 Oct 2026")).toBeInTheDocument();
  });

  it("displays locked badge with locked state indicator", () => {
    render(
      <RpgBadgeCard
        name="Conquérant des Cimes"
        description="Gravir 1 000m de D+"
        icon="shield-outline"
        unlocked={false}
      />,
    );
    expect(screen.getByText("Conquérant des Cimes")).toBeInTheDocument();
    expect(screen.getByText(/Verrouillé/i)).toBeInTheDocument();
  });
});
