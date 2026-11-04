import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  GeolocationDebugConsole,
  type GeolocationDebugConsoleProps,
} from "./GeolocationDebugConsole";

describe("GeolocationDebugConsole component", () => {
  const defaultProps: GeolocationDebugConsoleProps = {
    position: null,
    status: "waiting",
    error: null,
    simulating: false,
    defaultExpanded: true,
  };

  it("should render debug console with waiting state and placeholder dashes", () => {
    render(<GeolocationDebugConsole {...defaultProps} />);

    expect(screen.getByTestId("geolocation-debug-console")).toBeInTheDocument();
    expect(screen.getByText("Console Debug GPS")).toBeInTheDocument();
    expect(screen.getByTestId("debug-status")).toHaveTextContent(
      "Recherche signal",
    );

    expect(screen.getByTestId("debug-latitude")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-longitude")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-altitude")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-speed")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-accuracy")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-timestamp")).toHaveTextContent("--");
  });

  it("should render extended geolocation fields accurately when position is provided", () => {
    const position = {
      coords: [2.352222, 48.856614] as [number, number],
      latitude: 48.856614,
      longitude: 2.352222,
      altitude: 42.5,
      speed: 3.5, // 3.5 m/s = 12.6 km/h
      accuracy: 5.2,
      timestamp: 1700000000000,
    };

    render(
      <GeolocationDebugConsole
        {...defaultProps}
        position={position}
        status="tracking"
      />,
    );

    expect(screen.getByTestId("debug-status")).toHaveTextContent("Actif");
    expect(screen.getByTestId("debug-latitude")).toHaveTextContent("48.856614");
    expect(screen.getByTestId("debug-longitude")).toHaveTextContent("2.352222");
    expect(screen.getByTestId("debug-altitude")).toHaveTextContent("42.5 m");
    expect(screen.getByTestId("debug-speed")).toHaveTextContent(
      "12.6 km/h (3.5 m/s)",
    );
    expect(screen.getByTestId("debug-accuracy")).toHaveTextContent("±5.2 m");
    expect(screen.getByTestId("debug-timestamp")).toHaveTextContent(
      "1700000000000",
    );
  });

  it("should update displayed telemetry live when position prop changes", () => {
    const initialPosition = {
      coords: [2.35, 48.85] as [number, number],
      latitude: 48.85,
      longitude: 2.35,
      altitude: 30,
      speed: 1.0,
      accuracy: 10,
      timestamp: 1700000000000,
    };

    const { rerender } = render(
      <GeolocationDebugConsole
        {...defaultProps}
        position={initialPosition}
        status="tracking"
      />,
    );

    expect(screen.getByTestId("debug-latitude")).toHaveTextContent("48.850000");

    const nextPosition = {
      coords: [2.36, 48.86] as [number, number],
      latitude: 48.86,
      longitude: 2.36,
      altitude: 55,
      speed: 4.2,
      accuracy: 3.0,
      timestamp: 1700000005000,
    };

    rerender(
      <GeolocationDebugConsole
        {...defaultProps}
        position={nextPosition}
        status="tracking"
      />,
    );

    expect(screen.getByTestId("debug-latitude")).toHaveTextContent("48.860000");
    expect(screen.getByTestId("debug-longitude")).toHaveTextContent("2.360000");
    expect(screen.getByTestId("debug-altitude")).toHaveTextContent("55.0 m");
    expect(screen.getByTestId("debug-accuracy")).toHaveTextContent("±3.0 m");

    // Vérification de la présence des entrées dans le journal d'événements
    const logList = screen.getByTestId("debug-log-list");
    expect(logList.children.length).toBe(2);
  });

  it("should render error message when error prop is present", () => {
    render(
      <GeolocationDebugConsole
        {...defaultProps}
        status="denied"
        error="Permission GPS refusée par l'utilisateur."
      />,
    );

    expect(screen.getByTestId("debug-status")).toHaveTextContent(
      "Permission refusée",
    );
    expect(
      screen.getByText("Permission GPS refusée par l'utilisateur."),
    ).toBeInTheDocument();
  });

  it("should display simulation status pill when simulating is true", () => {
    render(<GeolocationDebugConsole {...defaultProps} simulating={true} />);

    expect(screen.getByTestId("debug-status")).toHaveTextContent("Simulé");
  });

  it("should toggle between expanded and collapsed modes", () => {
    render(<GeolocationDebugConsole {...defaultProps} defaultExpanded={true} />);

    const toggleBtn = screen.getByTestId("debug-toggle-btn");
    expect(toggleBtn).toHaveTextContent("▲ Réduire");
    expect(screen.getByTestId("debug-latitude")).toBeInTheDocument();

    // Clic pour replier
    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveTextContent("▼ Détails");
    expect(screen.queryByTestId("debug-latitude")).not.toBeInTheDocument();

    // Clic pour rouvrir
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent("▲ Réduire");
    expect(screen.getByTestId("debug-latitude")).toBeInTheDocument();
  });

  it("should clear the logs when clicking the Effacer button", () => {
    const position = {
      coords: [2.35, 48.85] as [number, number],
      latitude: 48.85,
      longitude: 2.35,
      altitude: 30,
      speed: 1.0,
      accuracy: 10,
      timestamp: 1700000000000,
    };

    render(
      <GeolocationDebugConsole
        {...defaultProps}
        position={position}
        status="tracking"
      />,
    );

    const clearBtn = screen.getByText("Effacer");
    fireEvent.click(clearBtn);

    expect(screen.getByText("Aucun événement enregistré.")).toBeInTheDocument();
  });

  it("should handle null altitude and null speed gracefully without throwing", () => {
    const position = {
      coords: [2.35, 48.85] as [number, number],
      latitude: 48.85,
      longitude: 2.35,
      altitude: null,
      speed: null,
      accuracy: 8.5,
      timestamp: 1700000000000,
    };

    render(
      <GeolocationDebugConsole
        {...defaultProps}
        position={position}
        status="tracking"
      />,
    );

    expect(screen.getByTestId("debug-latitude")).toHaveTextContent("48.850000");
    expect(screen.getByTestId("debug-longitude")).toHaveTextContent("2.350000");
    expect(screen.getByTestId("debug-altitude")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-speed")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-accuracy")).toHaveTextContent("±8.5 m");
  });

  it("should cap the rolling log buffer at 20 entries under rapid telemetry updates", () => {
    const { rerender } = render(
      <GeolocationDebugConsole {...defaultProps} status="tracking" />,
    );

    // Émettre 25 positions successives (rafale > 10 Hz)
    for (let i = 1; i <= 25; i++) {
      const pos = {
        coords: [2.35 + i * 0.0001, 48.85 + i * 0.0001] as [number, number],
        latitude: 48.85 + i * 0.0001,
        longitude: 2.35 + i * 0.0001,
        altitude: 40 + i,
        speed: 2 + i * 0.1,
        accuracy: 4,
        timestamp: 1700000000000 + i * 100,
      };

      rerender(
        <GeolocationDebugConsole
          {...defaultProps}
          position={pos}
          status="tracking"
        />,
      );
    }

    const logList = screen.getByTestId("debug-log-list");
    // Le buffer doit être plafonné à 20 entrées
    expect(logList.children.length).toBe(20);
    // Le compteur d'événements doit afficher 25
    expect(screen.getByText("#25")).toBeInTheDocument();
  });

  it("should safely handle corrupted or non-finite values without throwing", () => {
    // Coordonnées avec NaN et valeurs anormales
    const corruptedPosition = {
      coords: [NaN, NaN] as [number, number],
      latitude: NaN,
      longitude: NaN,
      altitude: Infinity,
      speed: NaN,
      accuracy: NaN,
      timestamp: -1,
    };

    render(
      <GeolocationDebugConsole
        {...defaultProps}
        position={corruptedPosition}
        status="tracking"
      />,
    );

    expect(screen.getByTestId("debug-latitude")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-longitude")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-altitude")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-speed")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-accuracy")).toHaveTextContent("--");
    expect(screen.getByTestId("debug-timestamp")).toHaveTextContent("--");
  });
});
