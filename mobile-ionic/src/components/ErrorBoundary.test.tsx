import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

const CrashingComponent = ({ shouldCrash }: { shouldCrash: boolean }) => {
  if (shouldCrash) {
    throw new Error("Simulated crash");
  }
  return <div>Contenu sécurisé</div>;
};

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Tout va bien</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Tout va bien")).toBeInTheDocument();
  });

  it("catches errors and renders fallback UI with retry button", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary fallbackTitle="Erreur personnalisée">
        <CrashingComponent shouldCrash={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Erreur personnalisée")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /réessayer/i }),
    ).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
