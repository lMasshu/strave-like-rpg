import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatMetric from "./StatMetric";

describe("StatMetric Component", () => {
  it("renders value, unit, and label accurately", () => {
    render(<StatMetric value="24.8" unit="km" label="Distance totale" />);
    expect(screen.getByText("24.8")).toBeInTheDocument();
    expect(screen.getByText("km")).toBeInTheDocument();
    expect(screen.getByText("Distance totale")).toBeInTheDocument();
  });

  it("handles numeric value and renders trend when provided", () => {
    render(
      <StatMetric
        value={142}
        unit="D+"
        label="Dénivelé"
        trend="+12% cette semaine"
      />,
    );
    expect(screen.getByText("142")).toBeInTheDocument();
    expect(screen.getByText("D+")).toBeInTheDocument();
    expect(screen.getByText("Dénivelé")).toBeInTheDocument();
    expect(screen.getByText("+12% cette semaine")).toBeInTheDocument();
  });
});
