import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  pointAlongRoute,
  routeLengthMeters,
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
