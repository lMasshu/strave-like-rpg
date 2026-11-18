import type { ActivityStart, NearbyPlayer } from '../ports/socialRepository.js';

/** Rayon d'une zone : l'échelle d'une ville. */
export const ZONE_RADIUS_METERS = 10_000;

export interface Zone {
  longitude: number;
  latitude: number;
  /** Nombre de mes sorties commencées dans la zone. */
  activityCount: number;
}

export interface HomeZones {
  /** Zone où la majorité de mes sorties ont commencé. */
  main: Zone;
  /** Zone de ma dernière sortie, si elle est différente de la principale. */
  last: Zone | null;
}

const EARTH_RADIUS_METERS = 6_371_000;

/** Distance à vol d'oiseau entre deux points (formule de haversine). */
export function distanceMeters(
  a: { longitude: number; latitude: number },
  b: { longitude: number; latitude: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isValidPoint(start: ActivityStart): boolean {
  return (
    Number.isFinite(start.longitude) &&
    Number.isFinite(start.latitude) &&
    Math.abs(start.latitude) <= 90 &&
    Math.abs(start.longitude) <= 180
  );
}

/**
 * Regroupe mes départs par zone (rayon {@link ZONE_RADIUS_METERS} autour du premier départ
 * de chaque zone) et renvoie la zone principale et celle de la dernière sortie.
 * À égalité, la zone la plus récemment fréquentée l'emporte.
 * `null` sans aucune sortie GPS.
 */
export function homeZones(starts: ActivityStart[]): HomeZones | null {
  const sorted = starts
    .filter(isValidPoint)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  if (sorted.length === 0) return null;

  // Parcours du plus récent au plus ancien : la première zone créée est celle de la dernière sortie.
  const zones: Zone[] = [];
  for (const start of sorted) {
    const zone = zones.find((z) => distanceMeters(z, start) <= ZONE_RADIUS_METERS);
    if (zone) zone.activityCount += 1;
    else zones.push({ longitude: start.longitude, latitude: start.latitude, activityCount: 1 });
  }

  const last = zones[0];
  // Tri stable : à égalité, l'ordre de création (le plus récent d'abord) est conservé.
  const main = [...zones].sort((a, b) => b.activityCount - a.activityCount)[0];
  return { main, last: last === main ? null : last };
}

export type SuggestionReason = 'main-zone' | 'last-zone';

export interface RankedSuggestion extends NearbyPlayer {
  reason: SuggestionReason;
}

/** Places réservées aux joueurs de la zone de la dernière sortie. */
export const LAST_ZONE_SLOTS = 3;

/**
 * Mélange les deux listes : la zone principale d'abord, puis quelques joueurs de la zone
 * de la dernière sortie ; les places libres sont rendues à l'autre liste. Sans doublon.
 */
export function rankSuggestions(
  mainZone: NearbyPlayer[],
  lastZone: NearbyPlayer[],
  limit: number,
): RankedSuggestion[] {
  const seen = new Set<string>();
  const unique = (list: NearbyPlayer[], reason: SuggestionReason): RankedSuggestion[] => {
    const kept: RankedSuggestion[] = [];
    for (const entry of list) {
      if (seen.has(entry.player.id)) continue;
      seen.add(entry.player.id);
      kept.push({ ...entry, reason });
    }
    return kept;
  };

  const main = unique(mainZone, 'main-zone');
  const last = unique(lastZone, 'last-zone');
  const lastCount = Math.min(LAST_ZONE_SLOTS, last.length, limit);
  const mainCount = Math.min(main.length, limit - lastCount);
  const extraLast = Math.min(last.length - lastCount, limit - mainCount - lastCount);

  return [...main.slice(0, mainCount), ...last.slice(0, lastCount + extraLast)];
}
