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

  it("should use Open-Meteo Geocoding when no Mapbox token is provided", async () => {
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

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOpenMeteo,
    } as Response);

    const results = await searchPointsOfInterest("Paris");

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Paris");
    expect(results[0].placeName).toBe("Paris, Île-de-France, France");
    expect(results[0].coordinates).toEqual([2.3488, 48.85341]);
    expect(results[0].category).toContain("42m alt.");
  });

  it("should fall back to local popular POIs when all network queries fail", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network down"));

    const results = await searchPointsOfInterest("Louvre");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain("Louvre");
  });
});
