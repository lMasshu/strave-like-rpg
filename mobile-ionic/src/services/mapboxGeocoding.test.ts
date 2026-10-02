import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchPointsOfInterest } from "./mapboxGeocoding";

describe("mapboxGeocoding service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty array for query with less than 2 characters", async () => {
    const results = await searchPointsOfInterest("a");
    expect(results).toEqual([]);
  });

  it("should query Open-Meteo Geocoding in priority even when Mapbox token is present", async () => {
    const mockOpenMeteo = {
      results: [
        {
          id: 2988507,
          name: "Paris",
          latitude: 48.85341,
          longitude: 2.3488,
          elevation: 42,
          country: "France",
          admin1: "Île-de-France",
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOpenMeteo,
    } as Response);
    globalThis.fetch = fetchMock;

    const results = await searchPointsOfInterest("Paris", "fake-token");

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("om-2988507");
    expect(results[0].name).toBe("Paris");
    expect(results[0].placeName).toBe("Paris, Île-de-France, France");
    expect(results[0].coordinates).toEqual([2.3488, 48.85341]);
    expect(results[0].category).toContain("42m alt.");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("geocoding-api.open-meteo.com"),
    );
  });

  it("should fall back to Mapbox Geocoding when Open-Meteo returns no results", async () => {
    const mockMapbox = {
      features: [
        {
          id: "poi.123",
          text: "Café de Paris",
          place_name: "Café de Paris, 75001 Paris",
          center: [2.34, 48.86],
          place_type: ["poi"],
        },
      ],
    };

    const fetchMock = vi
      .fn()
      // Premier appel : Open-Meteo (aucun résultat)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      } as Response)
      // Deuxième appel : Mapbox (résultats spécifiques)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMapbox,
      } as Response);
    globalThis.fetch = fetchMock;

    const results = await searchPointsOfInterest("Café de Paris", "fake-token");

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("poi.123");
    expect(results[0].name).toBe("Café de Paris");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "geocoding-api.open-meteo.com",
    );
    expect(fetchMock.mock.calls[1][0]).toContain("api.mapbox.com");
  });

  it("should fall back to local popular POIs when all network queries fail", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network down"));

    const results = await searchPointsOfInterest("Louvre");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain("Louvre");
  });
});
