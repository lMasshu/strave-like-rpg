import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchElevationForCoordinates, fetchRoute } from "./mapboxDirections";

describe("mapboxDirections service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchElevationForCoordinates", () => {
    it("should return fallback data for empty coordinates", async () => {
      const result = await fetchElevationForCoordinates([]);
      expect(result).toEqual({
        elevationGain: 0,
        elevationLoss: 0,
        minElevation: 0,
        maxElevation: 0,
        profile: [],
      });
    });

    it("should compute elevation gain, loss, min and max correctly from Open-Meteo response", async () => {
      const mockElevations = [30, 35, 40, 38, 50, 42];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ elevation: mockElevations }),
      } as Response);

      const coords: [number, number][] = [
        [2.35, 48.85],
        [2.36, 48.86],
        [2.37, 48.87],
        [2.38, 48.88],
        [2.39, 48.89],
        [2.4, 48.9],
      ];

      const result = await fetchElevationForCoordinates(coords);

      expect(result.profile).toEqual(mockElevations);
      expect(result.minElevation).toBe(30);
      expect(result.maxElevation).toBe(50);
      expect(result.elevationGain).toBeGreaterThan(0);
      expect(result.elevationLoss).toBeGreaterThan(0);
    });

    it("should handle API failure gracefully without throwing", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const coords: [number, number][] = [
        [2.35, 48.85],
        [2.36, 48.86],
      ];

      const result = await fetchElevationForCoordinates(coords);
      expect(result).toEqual({
        elevationGain: 0,
        elevationLoss: 0,
        minElevation: 0,
        maxElevation: 0,
        profile: [],
      });
    });
  });

  describe("fetchRoute", () => {
    it("should return offline fallback when no token and OSRM is unreachable", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

      const origin: [number, number] = [2.3522, 48.8566];
      const destination: [number, number] = [2.3376, 48.8606];

      const result = await fetchRoute(origin, destination);

      expect(result.source).toBe("offline-line");
      expect(result.distanceKm).toBeGreaterThan(0);
      expect(result.durationMinutes).toBeGreaterThan(0);
      expect(result.coordinates).toEqual([origin, destination]);
      expect(result.elevationGain).toBe(0);
    });
  });
});
