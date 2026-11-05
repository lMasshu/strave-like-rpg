import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  Geolocation,
  type Position,
  type WatchPositionCallback,
} from "@capacitor/geolocation";
import { useQuestRun } from "./useQuestRun";
import type { GeneratedQuest } from "../services/questGenerator";

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
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

describe("useQuestRun hook", () => {
  let watchCallback: WatchPositionCallback | null = null;
  const mockWatchId = "watch-run-123";

  const dummyQuest: GeneratedQuest = {
    id: "quest-sample",
    title: "Course des Remparts",
    description: "Courir jusqu'à la forteresse",
    type: "linear",
    difficulty: "easy",
    xpReward: 150,
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
      distanceKm: 0.8,
      durationMinutes: 5,
      elevationGain: 10,
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

  it("should initialize with running state and start geolocation tracker", async () => {
    const { result } = renderHook(() => useQuestRun(dummyQuest));

    expect(result.current.state.status).toBe("running");
    expect(result.current.position).toBeNull();

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    // Émission d'une position GPS
    act(() => {
      watchCallback?.(
        createMockPosition(
          {
            latitude: 48.8566,
            longitude: 2.3522,
            altitude: 40,
            speed: 2.5,
            accuracy: 5,
          },
          1700000000000,
        ),
      );
    });

    expect(result.current.position).not.toBeNull();
    expect(result.current.position?.latitude).toBe(48.8566);
    expect(result.current.position?.altitude).toBe(40);
    expect(result.current.gpsStatus).toBe("tracking");
  });

  it("should stop GPS tracking when simulation mode is activated", async () => {
    const { result } = renderHook(() => useQuestRun(dummyQuest));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    // Activer la marche simulée
    act(() => {
      result.current.toggleSimulation();
    });

    expect(result.current.simulating).toBe(true);

    // useGeolocationTracker est désactivé quand simulating = true
    await waitFor(() => {
      expect(Geolocation.clearWatch).toHaveBeenCalledWith({ id: mockWatchId });
    });
  });

  it("should automatically stop GPS tracking when quest reaches completion", async () => {
    const { result } = renderHook(() => useQuestRun(dummyQuest));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    // Reaching origin waypoint
    act(() => {
      watchCallback?.(
        createMockPosition(
          {
            latitude: 48.8566,
            longitude: 2.3522,
            accuracy: 2,
          },
          1700000000000,
        ),
      );
    });

    // Reaching destination waypoint
    act(() => {
      watchCallback?.(
        createMockPosition(
          {
            latitude: 48.86,
            longitude: 2.36,
            accuracy: 2,
          },
          1700000010000,
        ),
      );
    });

    expect(result.current.state.status).toBe("success");

    // Once status is no longer "running", clearWatch must be called
    await waitFor(() => {
      expect(Geolocation.clearWatch).toHaveBeenCalledWith({ id: mockWatchId });
    });
    expect(result.current.gpsStatus).toBe("idle");
  });
});
