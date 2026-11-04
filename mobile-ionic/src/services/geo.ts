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

/**
 * Calcule l'azimut (bearing) entre deux coordonnées en degrés [0, 360[
 */
export function calculateBearing(from: LngLat, to: LngLat): number {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Élagage des antennes parasites et demi-tours en cul-de-sac (Dead-end Spurs Removal).
 * Détecte les décrochés où le tracé quitte un carrefour, s'enfonce dans une impasse ou cour
 * intérieure pour toucher un jalon, fait demi-tour à 180° et revient au même carrefour.
 * L'antenne est court-circuitée pour que le tracé reste fluide sur la voie principale.
 */
export function pruneRouteSpurs(
  coordinates: LngLat[],
  maxSpurDistanceMeters = 380,
  intersectionThresholdMeters = 24,
): LngLat[] {
  if (!coordinates || coordinates.length < 8) {
    return coordinates;
  }

  const cleaned: LngLat[] = [...coordinates];
  let hasPruned = true;
  let passes = 0;

  while (hasPruned && passes < 4) {
    hasPruned = false;
    passes++;

    for (let i = 0; i < cleaned.length - 6; i++) {
      let subDistance = 0;
      let maxDistFromI = 0;
      let bestJ = -1;

      for (let j = i + 1; j < cleaned.length; j++) {
        subDistance += haversineMeters(cleaned[j - 1], cleaned[j]);

        if (subDistance > maxSpurDistanceMeters) {
          break;
        }

        const distFromI = haversineMeters(cleaned[i], cleaned[j]);
        if (distFromI > maxDistFromI) {
          maxDistFromI = distFromI;
        }

        // Si le point j est revenu au carrefour i après s'être enfoncé d'au moins 18m
        if (
          j >= i + 4 &&
          distFromI <= intersectionThresholdMeters &&
          maxDistFromI >= 18
        ) {
          bestJ = j;
        }
      }

      if (bestJ !== -1) {
        // Vérifier l'antiparallélisme : les segments d'entrée et de sortie doivent être opposés
        const inAngle = calculateBearing(cleaned[i], cleaned[i + 2]);
        const outAngle = calculateBearing(cleaned[bestJ - 2], cleaned[bestJ]);
        const angleDiff = Math.abs(inAngle - outAngle) % 360;
        const normalizedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;

        // Si la trajectoire fait demi-tour (angles opposés, proches de 180° à ±60°)
        if (Math.abs(normalizedDiff - 180) <= 60) {
          // Court-circuiter l'antenne : retirer les points entre i et bestJ
          cleaned.splice(i + 1, bestJ - i - 1);
          hasPruned = true;
          break;
        }
      }
    }
  }

  return cleaned;
}
