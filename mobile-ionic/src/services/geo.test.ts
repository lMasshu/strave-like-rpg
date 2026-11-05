import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  pointAlongRoute,
  routeLengthMeters,
  calculateBearing,
  pruneRouteSpurs,
  type LngLat,
} from "./geo";

describe("haversineMeters", () => {
  it("vaut 0 pour deux points identiques", () => {
    expect(haversineMeters([2.3, 49.9], [2.3, 49.9])).toBe(0);
  });

  it("mesure environ 111,2 km pour 1 degré de latitude", () => {
    const distance = haversineMeters([2.3, 49], [2.3, 50]);

    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(111_400);
  });

  it("est symétrique", () => {
    const a: LngLat = [2.2957, 49.8942];
    const b: LngLat = [2.3123, 49.9011];

    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe("routeLengthMeters", () => {
  it("additionne les segments du tracé", () => {
    const route: LngLat[] = [
      [2.3, 49],
      [2.3, 49.001],
      [2.3, 49.002],
    ];

    expect(routeLengthMeters(route)).toBeCloseTo(
      haversineMeters(route[0], route[2]),
      0,
    );
  });
});

describe("pointAlongRoute", () => {
  const route: LngLat[] = [
    [2.3, 49],
    [2.3, 49.01],
  ];

  it("renvoie le départ pour une distance nulle", () => {
    expect(pointAlongRoute(route, 0)).toEqual(route[0]);
  });

  it("renvoie la fin quand on dépasse la longueur du tracé", () => {
    expect(pointAlongRoute(route, 1_000_000)).toEqual(route[1]);
  });

  it("interpole à mi-chemin", () => {
    const half = routeLengthMeters(route) / 2;
    const point = pointAlongRoute(route, half);

    expect(point?.[1]).toBeCloseTo(49.005, 4);
  });

  it("renvoie null pour un tracé vide", () => {
    expect(pointAlongRoute([], 10)).toBeNull();
  });
});

describe("calculateBearing", () => {
  it("calcule le cap azimutal correct", () => {
    const north = calculateBearing([2.0, 48.0], [2.0, 49.0]);
    expect(north).toBeCloseTo(0, 0);

    const east = calculateBearing([2.0, 48.0], [3.0, 48.0]);
    expect(east).toBeCloseTo(90, 0);
  });
});

describe("pruneRouteSpurs", () => {
  it("élague automatiquement les antennes et demi-tours en cul-de-sac", () => {
    // Tracé qui s'engage dans une impasse, fait demi-tour à l'apex et ressort au même carrefour
    const trackWithSpur: LngLat[] = [
      [2.35, 48.85], // Carrefour A
      [2.35, 48.8504], // Impasse aller
      [2.35, 48.8508], // Impasse aller
      [2.35, 48.8512], // Apex de l'impasse (~130m de A)
      [2.35, 48.8508], // Impasse retour
      [2.35, 48.8504], // Impasse retour
      [2.35, 48.85], // Retour au Carrefour A
      [2.352, 48.85], // Poursuite de la boucle vers l'est
      [2.354, 48.85],
      [2.356, 48.85],
    ];

    const pruned = pruneRouteSpurs(trackWithSpur);

    // L'antenne de 130m doit avoir été court-circuitée
    expect(pruned.length).toBeLessThan(trackWithSpur.length);
    expect(pruned[0]).toEqual([2.35, 48.85]);
    expect(pruned[pruned.length - 1]).toEqual([2.356, 48.85]);
    // L'apex ne doit plus être dans le tracé
    expect(pruned.some((p) => p[1] === 48.8512)).toBe(false);
  });

  it("conserve intact un circuit fluide et ouvert", () => {
    const cleanLoop: LngLat[] = [
      [2.35, 48.85],
      [2.352, 48.852],
      [2.354, 48.854],
      [2.354, 48.858],
      [2.35, 48.86],
      [2.346, 48.858],
      [2.346, 48.854],
      [2.348, 48.852],
      [2.35, 48.85],
    ];

    const result = pruneRouteSpurs(cleanLoop);
    expect(result).toHaveLength(cleanLoop.length);
  });
});
