import type { GeneratedQuest } from "./questGenerator";
import { haversineMeters, routeLengthMeters, type LngLat } from "./geo";

// Rayon (m) dans lequel un point de passage est considéré comme atteint.
export const CHECKPOINT_RADIUS_METERS = 50;

// Les positions GPS moins précises que ça (en m) ne valident rien.
export const MAX_ACCEPTED_ACCURACY_METERS = 50;

// Temps imparti = durée estimée de l'itinéraire x ce facteur (avec un minimum).
export const TIME_LIMIT_FACTOR = 1.5;
export const MIN_TIME_LIMIT_MINUTES = 5;

export type QuestRunStatus = "running" | "success" | "failed";

export interface PositionFix {
  coords: LngLat;
  accuracy: number | null; // en mètres
}

export interface QuestRunState {
  status: QuestRunStatus;
  checkpointIndex: number; // nombre de points déjà validés
  totalCheckpoints: number;
  remainingMeters: number | null; // null tant qu'aucune position n'est connue
  remainingSeconds: number;
  elapsedSeconds: number;
}

export function getQuestTimeLimitSeconds(quest: GeneratedQuest): number {
  const minutes = Math.max(
    MIN_TIME_LIMIT_MINUTES,
    Math.ceil(quest.route.durationMinutes * TIME_LIMIT_FACTOR),
  );

  return minutes * 60;
}

export interface CheckpointEntry {
  coord: LngLat;
  routeIndex: number;
}

/**
 * Récupère les points de passage ordonnés ainsi que leur index exact
 * le long du tracé réel de la quête.
 */
export function getQuestCheckpointEntries(
  quest: GeneratedQuest,
): CheckpointEntry[] {
  const route = quest.route.coordinates;

  if (route.length === 0) {
    return [{ coord: quest.destination, routeIndex: 0 }];
  }

  const intermediateTargets = quest.waypoints.slice(1, -1);
  const entries: CheckpointEntry[] = [];
  let searchFrom = 0;

  for (const target of intermediateTargets) {
    let bestIndex = searchFrom;
    let bestDistance = Infinity;

    for (let i = searchFrom; i < route.length; i++) {
      const distance = haversineMeters(route[i], target);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    entries.push({ coord: route[bestIndex], routeIndex: bestIndex });
    searchFrom = bestIndex;
  }

  entries.push({
    coord: route[route.length - 1],
    routeIndex: route.length - 1,
  });

  return entries;
}

/**
 * Points de passage à valider, dans l'ordre.
 *
 * Ils sont recalés sur le tracé réel de l'itinéraire : un point de passage
 * placé hors route (champ, propriété privée) serait sinon impossible à atteindre.
 * Le premier waypoint est le départ, il n'est donc pas à valider. Le dernier
 * point est toujours la fin du tracé, ce qui empêche de valider une boucle
 * (départ = arrivée) sans l'avoir parcourue.
 */
export function getQuestCheckpoints(quest: GeneratedQuest): LngLat[] {
  return getQuestCheckpointEntries(quest).map((entry) => entry.coord);
}

/**
 * Calcule la distance restante exacte en mètres le long du tracé réel de la quête.
 */
export function distanceToFinish(
  position: LngLat,
  quest: GeneratedQuest,
  checkpointIndex: number,
): number {
  const route = quest.route.coordinates;
  const entries = getQuestCheckpointEntries(quest);

  if (checkpointIndex >= entries.length) {
    return 0;
  }

  if (route.length < 2) {
    return Math.round(
      haversineMeters(position, entries[checkpointIndex].coord),
    );
  }

  const targetRouteIndex = entries[checkpointIndex].routeIndex;
  const fromIndex =
    checkpointIndex === 0 ? 0 : entries[checkpointIndex - 1].routeIndex;

  // Recherche du point le plus proche sur le tronçon actif vers le checkpoint courant
  const searchLimit = Math.min(route.length - 1, targetRouteIndex + 5);
  let closestIndex = fromIndex;
  let minDistance = Infinity;

  for (let i = fromIndex; i <= searchLimit; i++) {
    const d = haversineMeters(position, route[i]);
    if (d < minDistance) {
      minDistance = d;
      closestIndex = i;
    }
  }

  // Distance restante = distance pour rejoindre le tracé + somme des segments réels jusqu'au bout
  let remainingAlongRoute = 0;
  for (let i = closestIndex + 1; i < route.length; i++) {
    remainingAlongRoute += haversineMeters(route[i - 1], route[i]);
  }

  return Math.round(minDistance + remainingAlongRoute);
}

export function createQuestRun(quest: GeneratedQuest): QuestRunState {
  const checkpoints = getQuestCheckpoints(quest);
  const initialMeters =
    quest.route.coordinates && quest.route.coordinates.length >= 2
      ? Math.round(routeLengthMeters(quest.route.coordinates))
      : Math.round((quest.route.distanceKm || 0) * 1000);

  return {
    status: "running",
    checkpointIndex: 0,
    totalCheckpoints: checkpoints.length,
    remainingMeters: initialMeters > 0 ? initialMeters : null,
    remainingSeconds: getQuestTimeLimitSeconds(quest),
    elapsedSeconds: 0,
  };
}

/**
 * Fait avancer la quête : valide les points atteints, met à jour les compteurs
 * et déclare la victoire (tous les points validés à temps) ou l'échec (temps écoulé).
 * `fix` vaut null quand on ne fait que faire avancer le chrono.
 */
export function advanceQuestRun(
  state: QuestRunState,
  quest: GeneratedQuest,
  fix: PositionFix | null,
  elapsedSeconds: number,
): QuestRunState {
  if (state.status !== "running") {
    return state;
  }

  const checkpoints = getQuestCheckpoints(quest);
  const remainingSeconds = Math.max(
    0,
    getQuestTimeLimitSeconds(quest) - elapsedSeconds,
  );

  let checkpointIndex = state.checkpointIndex;
  let remainingMeters = state.remainingMeters;

  if (
    fix &&
    fix.accuracy !== null &&
    Number.isFinite(fix.accuracy) &&
    fix.accuracy >= 0 &&
    fix.accuracy <= MAX_ACCEPTED_ACCURACY_METERS
  ) {
    while (
      checkpointIndex < checkpoints.length &&
      haversineMeters(fix.coords, checkpoints[checkpointIndex]) <=
        CHECKPOINT_RADIUS_METERS
    ) {
      checkpointIndex += 1;
    }
  }

  if (fix) {
    remainingMeters =
      checkpointIndex >= checkpoints.length
        ? 0
        : distanceToFinish(fix.coords, quest, checkpointIndex);
  }

  let status: QuestRunStatus = "running";

  if (checkpointIndex >= checkpoints.length) {
    status = "success";
  } else if (remainingSeconds <= 0) {
    status = "failed";
  }

  return {
    status,
    checkpointIndex,
    totalCheckpoints: checkpoints.length,
    remainingMeters,
    remainingSeconds,
    elapsedSeconds,
  };
}
