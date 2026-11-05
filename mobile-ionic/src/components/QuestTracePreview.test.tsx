import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import QuestTracePreview from "./QuestTracePreview";

describe("QuestTracePreview component", () => {
  it("renders SVG route preview with distance and elevation gain", () => {
    render(
      <QuestTracePreview
        distanceKm={6.2}
        elevationMeters={145}
        durationMinutes={40}
      />,
    );
    expect(screen.getByTestId("quest-trace-svg")).toBeInTheDocument();
    expect(screen.getByText(/145 m D\+/i)).toBeInTheDocument();
  });
});
