import type { GeneratedQuest } from "./questGenerator";
import { haversineMeters, type LngLat } from "./geo";

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
  accuracy: number; // en mètres
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
  const route = quest.route.coordinates;

  if (route.length === 0) {
    return [quest.destination];
  }

  const intermediateTargets = quest.waypoints.slice(1, -1);
  const checkpoints: LngLat[] = [];
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

    checkpoints.push(route[bestIndex]);
    searchFrom = bestIndex;
  }

  checkpoints.push(route[route.length - 1]);

  return checkpoints;
}

function distanceToFinish(
  position: LngLat,
  checkpoints: LngLat[],
  checkpointIndex: number,
): number {
  let total = haversineMeters(position, checkpoints[checkpointIndex]);

  for (let i = checkpointIndex + 1; i < checkpoints.length; i++) {
    total += haversineMeters(checkpoints[i - 1], checkpoints[i]);
  }

  return total;
}

export function createQuestRun(quest: GeneratedQuest): QuestRunState {
  return {
    status: "running",
    checkpointIndex: 0,
    totalCheckpoints: getQuestCheckpoints(quest).length,
    remainingMeters: null,
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

  if (fix && fix.accuracy <= MAX_ACCEPTED_ACCURACY_METERS) {
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
        : distanceToFinish(fix.coords, checkpoints, checkpointIndex);
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
