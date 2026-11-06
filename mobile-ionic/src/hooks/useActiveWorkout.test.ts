import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActiveWorkout } from "./useActiveWorkout";
import type { TrackedPosition } from "./useGeolocationTracker";

// Mock de useGeolocationTracker
let mockPosition: TrackedPosition | null = null;
let mockStatus: "idle" | "waiting" | "tracking" | "denied" = "idle";
let mockError: string | null = null;

vi.mock("./useGeolocationTracker", () => ({
  useGeolocationTracker: vi.fn(() => ({
    position: mockPosition,
    status: mockStatus,
    error: mockError,
  })),
}));

describe("useActiveWorkout hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPosition = null;
    mockStatus = "idle";
    mockError = null;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("should initialize with idle status and empty metrics", () => {
    const { result } = renderHook(() => useActiveWorkout());

    expect(result.current.metrics.status).toBe("idle");
    expect(result.current.metrics.elapsedSeconds).toBe(0);
    expect(result.current.metrics.distanceMeters).toBe(0);
    expect(result.current.metrics.distanceKm).toBe(0);
    expect(result.current.metrics.speedKmh).toBe(0);
    expect(result.current.metrics.paceMinPerKm).toBe("--:--");
    expect(result.current.metrics.trackCoordinates).toEqual([]);
    expect(result.current.metrics.simulating).toBe(false);
  });

  it("should transition to recording on startWorkout and increment elapsed time", () => {
    const { result } = renderHook(() => useActiveWorkout());

    act(() => {
      result.current.startWorkout();
    });

    expect(result.current.metrics.status).toBe("recording");

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.metrics.elapsedSeconds).toBe(3);
  });

  it("should pause and resume workout without losing elapsed time", () => {
    const { result } = renderHook(() => useActiveWorkout());

    act(() => {
      result.current.startWorkout();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.metrics.elapsedSeconds).toBe(5);

    act(() => {
      result.current.pauseWorkout();
    });
    expect(result.current.metrics.status).toBe("paused");

    // En pause, le temps ne doit pas s'incrémenter
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.metrics.elapsedSeconds).toBe(5);

    // Reprise
    act(() => {
      result.current.resumeWorkout();
    });
    expect(result.current.metrics.status).toBe("recording");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.metrics.elapsedSeconds).toBe(7);
  });

  it("should finish and reset workout", () => {
    const { result } = renderHook(() => useActiveWorkout());

    act(() => {
      result.current.startWorkout();
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    act(() => {
      result.current.finishWorkout();
    });
    expect(result.current.metrics.status).toBe("finished");

    act(() => {
      result.current.resetWorkout();
    });
    expect(result.current.metrics.status).toBe("idle");
    expect(result.current.metrics.elapsedSeconds).toBe(0);
  });

  it("should accumulate distance and compute pace when receiving GPS updates", () => {
    const { result, rerender } = renderHook(() => useActiveWorkout());

    act(() => {
      result.current.startWorkout();
    });

    // Premier point : Paris Centre [2.3522, 48.8566]
    mockPosition = {
      coords: [2.3522, 48.8566],
      longitude: 2.3522,
      latitude: 48.8566,
      altitude: 35,
      speed: 3.0,
      accuracy: 5,
      timestamp: 1000,
    };
    mockStatus = "tracking";
    rerender();

    expect(result.current.metrics.trackCoordinates.length).toBe(1);
    expect(result.current.metrics.distanceMeters).toBe(0);

    // Deuxième point ~100m plus loin
    mockPosition = {
      coords: [2.3535, 48.8566],
      longitude: 2.3535,
      latitude: 48.8566,
      altitude: 38,
      speed: 3.2, // ~11.5 km/h
      accuracy: 5,
      timestamp: 2000,
    };
    rerender();

    expect(result.current.metrics.trackCoordinates.length).toBe(2);
    expect(result.current.metrics.distanceMeters).toBeGreaterThan(50);
    expect(result.current.metrics.elevationGainMeters).toBe(3); // 38 - 35
  });

  it("should toggle simulation mode and advance track automatically", () => {
    const { result } = renderHook(() => useActiveWorkout());

    act(() => {
      result.current.startWorkout();
      result.current.toggleSimulation();
    });

    expect(result.current.metrics.simulating).toBe(true);

    // Faire avancer de 3 secondes en simulation
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.metrics.trackCoordinates.length).toBeGreaterThan(0);
    expect(result.current.metrics.distanceMeters).toBeGreaterThan(0);
    expect(result.current.metrics.speedKmh).toBeGreaterThan(0);
  });
});
