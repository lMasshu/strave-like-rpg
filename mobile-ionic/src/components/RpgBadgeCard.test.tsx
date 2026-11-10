import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RpgBadgeCard from "./RpgBadgeCard";

describe("RpgBadgeCard Component", () => {
  it("displays unlocked badge correctly", () => {
    render(
      <RpgBadgeCard
        name="Pionnier 10K"
        description="Parcourir 10km en une sortie"
        icon="star"
        unlocked={true}
        unlockedAt="12 Oct 2026"
      />,
    );
    expect(screen.getByText("Pionnier 10K")).toBeInTheDocument();
    expect(
      screen.getByText("Parcourir 10km en une sortie"),
    ).toBeInTheDocument();
    expect(screen.getByText("12 Oct 2026")).toBeInTheDocument();
    expect(document.querySelector('[data-icon="star"]')).toBeInTheDocument();
  });

  it("displays locked badge with locked state indicator", () => {
    render(
      <RpgBadgeCard
        name="Conquérant des Cimes"
        description="Gravir 1 000m de D+"
        icon="security"
        unlocked={false}
      />,
    );
    expect(screen.getByText("Conquérant des Cimes")).toBeInTheDocument();
    expect(screen.getByText(/Verrouillé/i)).toBeInTheDocument();
    expect(
      document.querySelector('[data-icon="security"]'),
    ).toBeInTheDocument();
  });

  it("falls back to a valid icon when no icon is supplied", () => {
    render(
      <RpgBadgeCard
        name="Badge sans icône"
        description="Fallback"
        unlocked={true}
      />,
    );

    expect(document.querySelector('[data-icon="star"]')).toBeInTheDocument();
  });

  it("supports keyboard accessibility when onClick is provided", () => {
    const handleClick = vi.fn();
    render(
      <RpgBadgeCard
        name="Pionnier 10K"
        description="Parcourir 10km en une sortie"
        onClick={handleClick}
      />,
    );

    const buttonCard = screen.getByRole("button", { name: /Pionnier 10K/i });
    expect(buttonCard).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(buttonCard, { key: "Enter" });
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(buttonCard, { key: " " });
    expect(handleClick).toHaveBeenCalledTimes(2);

    fireEvent.click(buttonCard);
    expect(handleClick).toHaveBeenCalledTimes(3);
  });
});
