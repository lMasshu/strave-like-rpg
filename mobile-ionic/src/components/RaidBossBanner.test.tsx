import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RaidBossBanner from "./RaidBossBanner";

describe("RaidBossBanner Component", () => {
  it("displays boss name, location, and HP progress bar", () => {
    render(
      <RaidBossBanner
        name="Titan des Collines"
        location="Forêt Régionale"
        currentHp={35000}
        maxHp={100000}
        endsIn="3j 14h"
      />,
    );
    expect(screen.getByText("Titan des Collines")).toBeInTheDocument();
    expect(screen.getByText("Forêt Régionale")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(screen.getByText(/3j 14h/)).toBeInTheDocument();
    expect(document.querySelector('[data-icon="alert"]')).toBeInTheDocument();
  });

  it("handles zero HP without errors", () => {
    render(
      <RaidBossBanner
        name="Titan Vaincu"
        location="Somme"
        currentHp={0}
        maxHp={50000}
        endsIn="Terminé"
      />,
    );
    expect(screen.getByText("Titan Vaincu")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
