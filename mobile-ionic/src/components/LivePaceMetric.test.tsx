import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LivePaceMetric from "./LivePaceMetric";

describe("map live pace metric", () => {
  it.each([
    ["stopped", "À l'arrêt"],
    ["unavailable", "Signal GPS indisponible"],
    ["paused", "En pause"],
  ] as const)(
    "explains %s rather than displaying an ambiguous dash",
    (state, label) => {
      render(<LivePaceMetric state={state} paceMinPerKm="--:--" />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText("--:--")).toBeInTheDocument();
    },
  );

  it("shows the current pace when moving", () => {
    render(<LivePaceMetric state="moving" paceMinPerKm="5:33" />);
    expect(screen.getByText("5:33")).toBeInTheDocument();
    expect(screen.getByText("Rythme réel")).toBeInTheDocument();
  });
});
