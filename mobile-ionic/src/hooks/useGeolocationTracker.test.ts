import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Capacitor } from "@capacitor/core";
import {
  Geolocation,
  type PermissionStatus,
  type Position,
  type WatchPositionCallback,
} from "@capacitor/geolocation";
import { useGeolocationTracker } from "./useGeolocationTracker";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

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

describe("useGeolocationTracker hook", () => {
  let watchCallback: WatchPositionCallback | null = null;
  const mockWatchId = "watch-12345";

  beforeEach(() => {
    vi.clearAllMocks();
    watchCallback = null;

    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
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

  it("should remain idle and not register watchPosition when enabled is false", () => {
    const { result } = renderHook(() => useGeolocationTracker(false));

    expect(result.current.status).toBe("idle");
    expect(result.current.position).toBeNull();
    expect(result.current.error).toBeNull();
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  });

  it("should start GPS tracking and handle successful positions with extended fields", async () => {
    const { result } = renderHook(() => useGeolocationTracker(true));

    expect(result.current.status).toBe("waiting");

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalledWith(
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        expect.any(Function),
      );
    });

    // Émission d'une première mise à jour GPS avec données étendues
    const mockGpsData1 = createMockPosition(
      {
        latitude: 48.8566,
        longitude: 2.3522,
        altitude: 35.5,
        speed: 2.8,
        accuracy: 4.2,
        heading: 180,
        altitudeAccuracy: 1.5,
      },
      1700000000000,
    );

    act(() => {
      watchCallback?.(mockGpsData1);
    });

    expect(result.current.status).toBe("tracking");
    expect(result.current.error).toBeNull();
    expect(result.current.position).toEqual({
      coords: [2.3522, 48.8566],
      latitude: 48.8566,
      longitude: 2.3522,
      altitude: 35.5,
      speed: 2.8,
      accuracy: 4.2,
      heading: 180,
      altitudeAccuracy: 1.5,
      timestamp: 1700000000000,
    });

    // Émission continue d'une seconde mise à jour GPS
    const mockGpsData2 = createMockPosition(
      {
        latitude: 48.857,
        longitude: 2.353,
        altitude: 38.0,
        speed: 3.5,
        accuracy: 3.1,
        heading: 90,
        altitudeAccuracy: 1.2,
      },
      1700000005000,
    );

    act(() => {
      watchCallback?.(mockGpsData2);
    });

    expect(result.current.position?.latitude).toBe(48.857);
    expect(result.current.position?.longitude).toBe(2.353);
    expect(result.current.position?.altitude).toBe(38.0);
    expect(result.current.position?.speed).toBe(3.5);
    expect(result.current.position?.accuracy).toBe(3.1);
    expect(result.current.position?.timestamp).toBe(1700000005000);
  });

  it("should stop GPS tracking and call clearWatch when enabled transitions to false", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useGeolocationTracker(enabled),
      {
        initialProps: { enabled: true },
      },
    );

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    // Désactivation du suivi (fin de quête)
    rerender({ enabled: false });

    await waitFor(() => {
      expect(Geolocation.clearWatch).toHaveBeenCalledWith({ id: mockWatchId });
    });
    expect(result.current.status).toBe("idle");
  });

  it("should clean up and call clearWatch when component unmounts", async () => {
    const { unmount } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    unmount();

    expect(Geolocation.clearWatch).toHaveBeenCalledWith({ id: mockWatchId });
  });

  it("should handle native platform permission request and deny if refused", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({
      location: "denied",
      coarseLocation: "denied",
    });

    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.requestPermissions).toHaveBeenCalled();
      expect(result.current.status).toBe("denied");
      expect(result.current.error).toBe("Permission de localisation refusée.");
    });

    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  });

  it("should handle checkPermissions returning denied on web", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({
      location: "denied",
      coarseLocation: "denied",
    });

    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(result.current.status).toBe("denied");
      expect(result.current.error).toBe("Permission de localisation refusée.");
    });

    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  });

  it("should handle GPS watch errors gracefully", async () => {
    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    act(() => {
      watchCallback?.(null, new Error("GPS connection lost"));
    });

    expect(result.current.error).toBe(
      "Signal GPS indisponible pour le moment.",
    );
  });

  it("should detect permission denied error during watchPosition callback", async () => {
    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    act(() => {
      watchCallback?.(null, {
        code: 1,
        message: "User denied Geolocation",
      });
    });

    expect(result.current.status).toBe("denied");
    expect(result.current.error).toBe("Permission de localisation refusée.");
  });

  it("should cleanly handle GPS positions with null altitude and null speed (2D fix)", async () => {
    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    act(() => {
      watchCallback?.(
        createMockPosition(
          {
            latitude: 48.85,
            longitude: 2.35,
            altitude: null,
            speed: null,
            accuracy: 12,
          },
          1700000000000,
        ),
      );
    });

    expect(result.current.status).toBe("tracking");
    expect(result.current.position?.altitude).toBeNull();
    expect(result.current.position?.speed).toBeNull();
    expect(result.current.position?.accuracy).toBe(12);
  });

  it("should transition status back to 'waiting' when GPS signal is lost after active tracking", async () => {
    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    // Émettre d'abord un fix GPS valide
    act(() => {
      watchCallback?.(
        createMockPosition({
          latitude: 48.8566,
          longitude: 2.3522,
          accuracy: 5,
        }),
      );
    });

    expect(result.current.status).toBe("tracking");
    expect(result.current.error).toBeNull();

    // Perte soudaine du signal satellite
    act(() => {
      watchCallback?.(null, new Error("Location timeout / satellite lost"));
    });

    expect(result.current.status).toBe("waiting");
    expect(result.current.error).toBe(
      "Signal GPS indisponible pour le moment.",
    );
  });

  it("should abort without calling watchPosition if unmounted while checking permissions", async () => {
    let resolvePerm: ((val: PermissionStatus) => void) | undefined;
    vi.mocked(Geolocation.checkPermissions).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePerm = resolve;
        }),
    );

    const { unmount } = renderHook(() => useGeolocationTracker(true));

    // Démonter pendant que la permission est en cours de résolution
    unmount();

    // Résoudre la permission après le démontage
    const cb = resolvePerm as ((val: PermissionStatus) => void) | undefined;
    cb?.({ location: "granted", coarseLocation: "granted" });

    await Promise.resolve();

    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  });

  it("should proceed to watchPosition on web when checkPermissions returns prompt", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({
      location: "prompt",
      coarseLocation: "prompt",
    });

    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    expect(result.current.status).toBe("waiting");
    expect(result.current.error).toBeNull();
  });

  it("should proceed on native platform when coarseLocation is granted (approximate location)", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({
      location: "prompt",
      coarseLocation: "granted",
    });

    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    expect(result.current.status).toBe("waiting");
  });

  it("should reject corrupted coordinates (NaN or out of bounds) and remain in waiting state", async () => {
    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    // Émettre des coordonnées aberrantes (lat > 90)
    act(() => {
      watchCallback?.(
        createMockPosition({
          latitude: 999.0,
          longitude: 2.35,
          accuracy: 5,
        }),
      );
    });

    expect(result.current.status).toBe("waiting");
    expect(result.current.error).toBe("Coordonnées GPS reçues invalides.");
    expect(result.current.position).toBeNull();
  });

  it("should sanitize negative speed and negative accuracy to null and 0", async () => {
    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    act(() => {
      watchCallback?.(
        createMockPosition({
          latitude: 48.85,
          longitude: 2.35,
          speed: -1,
          accuracy: -5,
        }),
      );
    });

    expect(result.current.status).toBe("tracking");
    expect(result.current.position?.speed).toBeNull();
    expect(result.current.position?.accuracy).toBe(0);
  });

  it("should detect permission denial when watchError is a raw string", async () => {
    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(Geolocation.watchPosition).toHaveBeenCalled();
    });

    act(() => {
      watchCallback?.(
        null,
        "User denied Geolocation access" as unknown as Error,
      );
    });

    expect(result.current.status).toBe("denied");
    expect(result.current.error).toBe("Permission de localisation refusée.");
  });

  it("should classify startup non-permission errors as waiting instead of denied", async () => {
    vi.mocked(Geolocation.watchPosition).mockRejectedValueOnce(
      new Error("Location services unavailable / sensor disabled"),
    );

    const { result } = renderHook(() => useGeolocationTracker(true));

    await waitFor(() => {
      expect(result.current.status).toBe("waiting");
      expect(result.current.error).toBe(
        "Impossible d'accéder à la position GPS.",
      );
    });
  });
});
