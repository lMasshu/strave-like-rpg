export type LngLat = [number, number]; // [longitude, latitude]

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Distance à vol d'oiseau entre deux points GPS, en mètres (formule de Haversine).
 */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(b[0] - a[0]);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Longueur totale d'un tracé, en mètres.
 */
export function routeLengthMeters(coordinates: LngLat[]): number {
  let total = 0;

  for (let i = 1; i < coordinates.length; i++) {
    total += haversineMeters(coordinates[i - 1], coordinates[i]);
  }

  return total;
}

/**
 * Point situé à `distanceMeters` du début du tracé (borné au début et à la fin).
 * Sert à simuler une marche le long d'un parcours pour tester sans bouger.
 */
export function pointAlongRoute(
  coordinates: LngLat[],
  distanceMeters: number,
): LngLat | null {
  if (coordinates.length === 0) {
    return null;
  }

  if (distanceMeters <= 0 || coordinates.length === 1) {
    return coordinates[0];
  }

  let remaining = distanceMeters;

  for (let i = 1; i < coordinates.length; i++) {
    const start = coordinates[i - 1];
    const end = coordinates[i];
    const segment = haversineMeters(start, end);

    if (segment > 0 && remaining <= segment) {
      const ratio = remaining / segment;

      return [
        start[0] + (end[0] - start[0]) * ratio,
        start[1] + (end[1] - start[1]) * ratio,
      ];
    }

    remaining -= segment;
  }

  return coordinates[coordinates.length - 1];
}
