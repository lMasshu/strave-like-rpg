import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import {
  Geolocation,
  type Position,
  type WatchPositionCallback,
} from "@capacitor/geolocation";
import mapboxgl from "mapbox-gl";
import QuestRunHud from "./QuestRunHud";
import type { GeneratedQuest } from "../services/questGenerator";

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    notification: vi.fn().mockResolvedValue(undefined),
  },
  NotificationType: {
    Success: "SUCCESS",
    Error: "ERROR",
  },
}));

const mockMarkerInstance = {
  setLngLat: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
};

vi.mock("mapbox-gl", () => ({
  default: {
    Marker: vi.fn().mockImplementation(function () {
      return mockMarkerInstance;
    }),
  },
}));

function createMockPosition(
  coords: Partial<Position["coords"]> & {
    latitude: number;
    longitude: number;
    accuracy: number;
  },
  timestamp = Date.now(),
): Position {
  return {
    timestamp,
    coords: {
      altitude: null,
      altitudeAccuracy: null,
      speed: null,
      heading: null,
      magneticHeading: null,
      trueHeading: null,
      headingAccuracy: null,
      course: null,
      ...coords,
    },
  };
}

describe("QuestRunHud integration with Geolocation & Debug Console", () => {
  let watchCallback: WatchPositionCallback | null = null;
  const mockWatchId = "watch-quest-999";

  const dummyQuest: GeneratedQuest = {
    id: "quest-101",
    title: "Le Défi des Remparts",
    description: "Courir jusqu'à la forteresse",
    type: "linear",
    difficulty: "medium",
    xpReward: 250,
    origin: [2.3522, 48.8566],
    destination: [2.36, 48.86],
    waypoints: [
      [2.3522, 48.8566],
      [2.36, 48.86],
    ],
    route: {
      coordinates: [
        [2.3522, 48.8566],
        [2.36, 48.86],
      ],
      distanceKm: 1.2,
      durationMinutes: 10,
      elevationGain: 15,
      elevationLoss: 5,
      source: "mapbox",
    },
    createdAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    watchCallback = null;

    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({
      location: "granted",
      coarseLocation: "granted",
    });
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({
      location: "granted",
      coarseLocation: "granted",
    });
    vi.mocked(Geolocation.watchPosition).mockImplementation(
      async (_options, callback) => {
        watchCallback = callback;
        return mockWatchId;
      },
    );
    vi.mocked(Geolocation.clearWatch).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should start GPS tracking automatically upon quest launch and render the debug console", async () => {
    const onFinish = vi.fn();

    render(<QuestRunHud quest={dummyQuest} map={null} onFinish={onFinish} />);

    // Le composant de console debug est présent et visible dès le lancement de la quête
    const debugConsole = screen.getByTestId("geolocation-debug-console");
    expect(debugConsole).toBeInTheDocument();
    expect(screen.getByText("Console Debug GPS")).toBeInTheDocument();

    // La demande d'écoute GPS s'est lancée
    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalledWith(
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        expect.any(Function),
      );
    });
  });

  it("should transmit live GPS stream with extended info to the debug console", async () => {
    const onFinish = vi.fn();

    render(<QuestRunHud quest={dummyQuest} map={null} onFinish={onFinish} />);

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    // Émission d'un événement GPS avec coordonnées, altitude, vitesse, précision et horodatage
    act(() => {
      watchCallback?.(
        createMockPosition(
          {
            latitude: 48.8584,
            longitude: 2.2945,
            altitude: 62.4,
            speed: 3.2, // ~11.5 km/h
            accuracy: 4.8,
          },
          1700000042000,
        ),
      );
    });

    // Vérification que les informations étendues sont immédiatement affichées dans la console debug
    expect(screen.getByTestId("debug-latitude")).toHaveTextContent("48.858400");
    expect(screen.getByTestId("debug-longitude")).toHaveTextContent("2.294500");
    expect(screen.getByTestId("debug-altitude")).toHaveTextContent("62.4 m");
    expect(screen.getByTestId("debug-speed")).toHaveTextContent(
      "11.5 km/h (3.2 m/s)",
    );
    expect(screen.getByTestId("debug-accuracy")).toHaveTextContent("±4.8 m");
    expect(screen.getByTestId("debug-timestamp")).toHaveTextContent(
      "1700000042000",
    );
    expect(screen.getByTestId("debug-status")).toHaveTextContent("Actif");
  });

  it("should cleanly stop GPS tracking and call clearWatch when the quest stops / unmounts", async () => {
    const onFinish = vi.fn();

    const { unmount } = render(
      <QuestRunHud quest={dummyQuest} map={null} onFinish={onFinish} />,
    );

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    // Fermeture / conclusion de la quête
    unmount();

    expect(Geolocation.clearWatch).toHaveBeenCalledWith({ id: mockWatchId });
  });

  it("should update the map marker when map instance is present and clean it up on unmount", async () => {
    const onFinish = vi.fn();
    const fakeMap = {} as mapboxgl.Map;

    const { unmount } = render(
      <QuestRunHud quest={dummyQuest} map={fakeMap} onFinish={onFinish} />,
    );

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    act(() => {
      watchCallback?.(
        createMockPosition(
          {
            latitude: 48.858,
            longitude: 2.294,
            altitude: 50,
            speed: 2,
            accuracy: 5,
          },
          1700000000000,
        ),
      );
    });

    expect(mapboxgl.Marker).toHaveBeenCalled();
    expect(mockMarkerInstance.setLngLat).toHaveBeenCalledWith([2.294, 48.858]);

    // Deuxième position : le marqueur réutilise setLngLat sans recréer d'instance
    act(() => {
      watchCallback?.(
        createMockPosition(
          {
            latitude: 48.859,
            longitude: 2.295,
            altitude: 52,
            speed: 3,
            accuracy: 4,
          },
          1700000002000,
        ),
      );
    });

    expect(mockMarkerInstance.setLngLat).toHaveBeenCalledWith([2.295, 48.859]);

    unmount();
    expect(mockMarkerInstance.remove).toHaveBeenCalled();
  });
});
