import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { StrictMode } from "react";
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
    vi.setSystemTime(100_000);
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
    act(() => vi.advanceTimersByTime(1000));
    mockPosition = {
      coords: [2.3522, 48.8566],
      longitude: 2.3522,
      latitude: 48.8566,
      altitude: 35,
      speed: 3.0,
      accuracy: 5,
      timestamp: 101000,
    };
    mockStatus = "tracking";
    rerender();

    expect(result.current.metrics.trackCoordinates.length).toBe(1);
    expect(result.current.metrics.distanceMeters).toBe(0);

    // Deuxième point ~95m plus loin après 15 secondes (~6.3 m/s)
    act(() => vi.advanceTimersByTime(15000));
    mockPosition = {
      coords: [2.3535, 48.8566],
      longitude: 2.3535,
      latitude: 48.8566,
      altitude: 38,
      speed: 3.2, // ~11.5 km/h
      accuracy: 5,
      timestamp: 116000,
    };
    rerender();

    expect(result.current.metrics.trackCoordinates.length).toBe(2);
    expect(result.current.metrics.distanceMeters).toBe(0); // GPS gap: no artificial bridge
    expect(result.current.metrics.elevationGainMeters).toBe(0);
    expect(result.current.metrics.paceMinPerKm).toBe("5:13");
  });

  it("should reject inaccurate GPS fixes (accuracy > 25m) and not accumulate false distance", () => {
    const { result, rerender } = renderHook(() => useActiveWorkout());

    act(() => {
      result.current.startWorkout();
    });

    // Point 1 : Valide (accuracy: 6m)
    act(() => vi.advanceTimersByTime(1000));
    mockPosition = {
      coords: [2.3522, 48.8566],
      longitude: 2.3522,
      latitude: 48.8566,
      altitude: 35,
      speed: 3.0,
      accuracy: 6,
      timestamp: 101000,
    };
    mockStatus = "tracking";
    rerender();

    expect(result.current.metrics.trackCoordinates.length).toBe(1);

    // Point 2 : Imprécis (accuracy: 65m - ex: saut triangulé 4G / Wi-Fi)
    act(() => vi.advanceTimersByTime(1000));
    mockPosition = {
      coords: [2.355, 48.858], // Décalage de ~200m
      longitude: 2.355,
      latitude: 48.858,
      altitude: 35,
      speed: 1.0,
      accuracy: 65,
      timestamp: 102000,
    };
    rerender();

    // Doit être ignoré pour le tracé et la distance
    expect(result.current.metrics.trackCoordinates.length).toBe(1);
    expect(result.current.metrics.distanceMeters).toBe(0);
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
    expect(result.current.metrics.paceState).toBe("moving");
    expect(result.current.metrics.paceMinPerKm).toBe("5:33");
  });

  function receiveFix(speed: number | null, longitude = 2.3522): void {
    mockStatus = "tracking";
    mockPosition = {
      coords: [longitude, 48.8566],
      longitude,
      latitude: 48.8566,
      altitude: 35,
      accuracy: 5,
      speed,
      timestamp: Date.now(),
    };
  }

  it("shows a stop rather than the workout average after more than 50 metres", () => {
    const { result, rerender } = renderHook(() => useActiveWorkout());
    act(() => result.current.startWorkout());
    act(() => vi.advanceTimersByTime(1000));
    receiveFix(3);
    rerender();
    for (let step = 1; step <= 15; step++) {
      act(() => vi.advanceTimersByTime(1000));
      receiveFix(3, 2.3522 + (0.0013 * step) / 15);
      rerender();
    }
    expect(result.current.metrics.distanceMeters).toBeGreaterThan(50);
    expect(result.current.metrics.paceMinPerKm).toBe("5:33");

    act(() => vi.advanceTimersByTime(1000));
    receiveFix(0, 2.3535);
    rerender();
    expect(result.current.metrics.paceState).toBe("stopped");
    expect(result.current.metrics.paceMinPerKm).toBe("--:--");
    expect(result.current.metrics.distanceMeters).toBeGreaterThan(50);
  });

  it("expires a fix without another GPS callback and recovers on a fresh fix", () => {
    const { result, rerender } = renderHook(() => useActiveWorkout());
    act(() => result.current.startWorkout());
    act(() => vi.advanceTimersByTime(1000));
    receiveFix(3);
    rerender();
    expect(result.current.metrics.paceMinPerKm).toBe("5:33");
    act(() => vi.advanceTimersByTime(2750));
    expect(result.current.metrics.paceState).toBe("moving");
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.metrics.paceState).toBe("unavailable");
    expect(result.current.metrics.paceMinPerKm).toBe("--:--");
    receiveFix(3);
    rerender();
    expect(result.current.metrics.paceState).toBe("moving");
  });

  it("does not reuse fixes from before starting or resuming", () => {
    receiveFix(3);
    const { result, rerender } = renderHook(() => useActiveWorkout());
    act(() => result.current.startWorkout());
    expect(result.current.metrics.paceState).toBe("unavailable");
    act(() => vi.advanceTimersByTime(250));
    receiveFix(3);
    rerender();
    expect(result.current.metrics.paceState).toBe("moving");
    act(() => result.current.pauseWorkout());
    expect(result.current.metrics.paceState).toBe("paused");
    expect(result.current.metrics.paceMinPerKm).toBe("--:--");
    act(() => vi.advanceTimersByTime(250));
    receiveFix(3);
    rerender();
    act(() => result.current.resumeWorkout());
    expect(result.current.metrics.paceState).toBe("unavailable");
    act(() => vi.advanceTimersByTime(250));
    receiveFix(3);
    rerender();
    expect(result.current.metrics.paceState).toBe("moving");
    act(() => result.current.finishWorkout());
    expect(result.current.metrics.paceState).toBe("inactive");
    expect(result.current.metrics.paceMinPerKm).toBe("--:--");
  });

  it("does not show movement or a stop when the GPS reports an error", () => {
    const { result, rerender } = renderHook(() => useActiveWorkout());
    act(() => result.current.startWorkout());
    act(() => vi.advanceTimersByTime(1000));
    receiveFix(3);
    rerender();
    mockStatus = "waiting";
    mockError = "Signal GPS indisponible pour le moment.";
    rerender();
    expect(result.current.metrics.paceState).toBe("unavailable");
    expect(result.current.metrics.paceMinPerKm).toBe("--:--");
  });

  it("does not declare slow walking an automatic pause", () => {
    const { result, rerender } = renderHook(() => useActiveWorkout());
    act(() => result.current.startWorkout());
    act(() => vi.advanceTimersByTime(1000));
    receiveFix(0.4);
    rerender();
    expect(result.current.metrics.paceState).toBe("moving");
    expect(result.current.metrics.paceMinPerKm).toBe("41:40");
    expect(result.current.metrics.status).toBe("recording");
  });

  it("cleans up freshness and workout timers on unmount", () => {
    const { result, unmount } = renderHook(() => useActiveWorkout());
    act(() => result.current.startWorkout());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("journals stationary and uncertain fixes once under StrictMode", () => {
    const { result, rerender } = renderHook(() => useActiveWorkout(), {
      wrapper: StrictMode,
    });
    act(() => result.current.startWorkout());
    act(() => vi.advanceTimersByTime(1000));
    receiveFix(0);
    rerender();
    rerender();
    act(() => vi.advanceTimersByTime(1000));
    receiveFix(null);
    mockPosition = { ...mockPosition!, accuracy: null };
    rerender();
    const snapshot = result.current.metrics.recordingSnapshot!;
    expect(snapshot.recording.samples).toHaveLength(2);
    expect(snapshot.recording.samples[1].horizontalAccuracyMeters).toBeNull();
    expect(snapshot.distanceMeters).toBe(0);
    act(() => result.current.finishWorkout());
    act(() => vi.advanceTimersByTime(30000));
    expect(result.current.metrics.recordingSnapshot?.endedAtMs).toBe(102000);
    expect(
      result.current.metrics.recordingSnapshot?.recording.activeDurationMs,
    ).toBe(2000);
    act(() => result.current.resetWorkout());
    expect(result.current.metrics.recordingSnapshot).toBeNull();
    expect(result.current.metrics.trackSegments).toEqual([]);
  });

  it("derives active time from actual intervals even if the timer is delayed", () => {
    const { result } = renderHook(() => useActiveWorkout());
    act(() => result.current.startWorkout());
    vi.setSystemTime(110000);
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.metrics.elapsedSeconds).toBe(10);
    act(() => result.current.pauseWorkout());
    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.finishWorkout());
    expect(
      result.current.metrics.recordingSnapshot?.recording.activeDurationMs,
    ).toBe(10250);
    expect(
      result.current.metrics.recordingSnapshot?.recording.elapsedDurationMs,
    ).toBe(15250);
  });
});
