import type {
  AuthorizationOptions,
  AuthorizationStatus,
  AvailabilityResult,
  HealthDataType,
  HealthSample,
  QueryOptions,
  QueryWorkoutsOptions,
  QueryWorkoutsResult,
  Workout,
  WorkoutType,
} from "@capgo/capacitor-health";
import type {
  WatchActivityType,
  WatchLinkStatus,
  WatchWorkout,
} from "../data/watchLink";

/** Sous-ensemble du plugin `@capgo/capacitor-health` utilisé ici (injectable en test). */
export interface HealthClient {
  isAvailable(): Promise<AvailabilityResult>;
  requestAuthorization(
    options: AuthorizationOptions,
  ): Promise<AuthorizationStatus>;
  checkAuthorization(
    options: AuthorizationOptions,
  ): Promise<AuthorizationStatus>;
  queryWorkouts(options: QueryWorkoutsOptions): Promise<QueryWorkoutsResult>;
  readSamples(options: QueryOptions): Promise<{ samples: HealthSample[] }>;
  openHealthConnectSettings(): Promise<void>;
}

/** Types lus : séances + mesures associées. Aucune écriture demandée. */
export const WATCH_READ_PERMISSIONS: AuthorizationOptions = {
  read: ["workouts", "heartRate", "distance", "calories"],
};

const WORKOUT_TYPE_TO_ACTIVITY: Partial<
  Record<WorkoutType, WatchActivityType>
> = {
  running: "run",
  runningTreadmill: "run",
  trackAndField: "run",
  walking: "walk",
  hiking: "hike",
  snowshoeing: "hike",
  cycling: "bike",
  bikingStationary: "bike",
  handCycling: "bike",
};

/** Convertit un type de séance natif en type d'activité Stride Quest, `null` si non géré. */
export function mapWorkoutType(type: WorkoutType): WatchActivityType | null {
  return WORKOUT_TYPE_TO_ACTIVITY[type] ?? null;
}

function toPlatform(
  platform: AvailabilityResult["platform"],
): WatchLinkStatus["platform"] {
  return platform ?? null;
}

function buildStatus(
  availability: AvailabilityResult,
  authorization: AuthorizationStatus,
): WatchLinkStatus {
  const readable = authorization.readAuthorized;
  return {
    state: readable.includes("workouts") ? "linked" : "not-linked",
    platform: toPlatform(availability.platform),
    heartRateAuthorized: readable.includes("heartRate"),
  };
}

function unavailableStatus(availability: AvailabilityResult): WatchLinkStatus {
  return {
    state: "unavailable",
    platform: toPlatform(availability.platform),
    heartRateAuthorized: false,
    reason: availability.reason,
  };
}

/** Lit l'état de la liaison sans afficher de demande d'autorisation. */
export async function getWatchLinkStatus(
  client: HealthClient,
): Promise<WatchLinkStatus> {
  const availability = await client.isAvailable();
  if (!availability.available) return unavailableStatus(availability);

  const authorization = await client.checkAuthorization(WATCH_READ_PERMISSIONS);
  return buildStatus(availability, authorization);
}

/** Affiche la fenêtre d'autorisation Health Connect / Apple Santé et renvoie le nouvel état. */
export async function linkWatch(
  client: HealthClient,
): Promise<WatchLinkStatus> {
  const availability = await client.isAvailable();
  if (!availability.available) return unavailableStatus(availability);

  const authorization = await client.requestAuthorization(
    WATCH_READ_PERMISSIONS,
  );
  return buildStatus(availability, authorization);
}

function toFiniteOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

/** Convertit une séance native, `null` si sport non géré ou données incohérentes. */
export function toWatchWorkout(workout: Workout): WatchWorkout | null {
  const activityType = mapWorkoutType(workout.workoutType);
  if (!activityType || !workout.platformId) return null;

  const startMs = Date.parse(workout.startDate);
  const endMs = Date.parse(workout.endDate);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }

  const duration = toFiniteOrNull(workout.duration);
  return {
    externalId: workout.platformId,
    activityType,
    startedAt: new Date(startMs).toISOString(),
    endedAt: new Date(endMs).toISOString(),
    durationSeconds: Math.round(duration ?? (endMs - startMs) / 1000),
    distanceMeters: toFiniteOrNull(workout.totalDistance),
    caloriesKcal: toFiniteOrNull(workout.totalEnergyBurned),
    sourceName: workout.sourceName ?? workout.sourceId ?? null,
  };
}

/**
 * Somme les échantillons écrits par l'appli `sourceId` pendant la séance.
 * Un échantillon à cheval sur les bornes est compté au prorata du chevauchement.
 * Renvoie `null` si cette appli n'a écrit aucun échantillon sur la période.
 */
export function sumSamplesFromSource(
  samples: HealthSample[],
  sourceId: string,
  startMs: number,
  endMs: number,
): number | null {
  let total = 0;
  let matched = false;

  for (const sample of samples) {
    if (sample.sourceId !== sourceId || !Number.isFinite(sample.value)) {
      continue;
    }
    const sampleStart = Date.parse(sample.startDate);
    const sampleEnd = Date.parse(sample.endDate);
    if (!Number.isFinite(sampleStart) || !Number.isFinite(sampleEnd)) continue;

    const overlap = Math.min(sampleEnd, endMs) - Math.max(sampleStart, startMs);
    const span = sampleEnd - sampleStart;
    if (span <= 0) {
      if (sampleStart < startMs || sampleStart > endMs) continue;
      total += sample.value;
    } else {
      if (overlap <= 0) continue;
      total += sample.value * Math.min(1, overlap / span);
    }
    matched = true;
  }

  return matched ? total : null;
}

/** Nombre max d'échantillons lus par séance (Garmin écrit en général 1 échantillon / minute). */
const SAMPLE_READ_LIMIT = 2000;

async function readSourceTotal(
  client: HealthClient,
  dataType: HealthDataType,
  sourceId: string,
  watchWorkout: WatchWorkout,
): Promise<number | null> {
  try {
    const { samples } = await client.readSamples({
      dataType,
      startDate: watchWorkout.startedAt,
      endDate: watchWorkout.endedAt,
      limit: SAMPLE_READ_LIMIT,
    });
    return sumSamplesFromSource(
      samples,
      sourceId,
      Date.parse(watchWorkout.startedAt),
      Date.parse(watchWorkout.endedAt),
    );
  } catch {
    return null;
  }
}

/**
 * Le total fourni par `queryWorkouts` agrège toutes les applis selon l'ordre de
 * priorité Health Connect : la distance du podomètre du téléphone (Samsung Health)
 * peut remplacer celle de la montre. On recalcule à partir des seuls échantillons
 * écrits par l'appli qui a enregistré la séance, et on garde l'agrégat en secours.
 */
export async function withSourceTotals(
  client: HealthClient,
  watchWorkout: WatchWorkout,
  sourceId: string | undefined,
): Promise<WatchWorkout> {
  if (!sourceId) return watchWorkout;

  const [distance, calories] = await Promise.all([
    readSourceTotal(client, "distance", sourceId, watchWorkout),
    readSourceTotal(client, "calories", sourceId, watchWorkout),
  ]);

  return {
    ...watchWorkout,
    distanceMeters: distance ?? watchWorkout.distanceMeters,
    caloriesKcal: calories ?? watchWorkout.caloriesKcal,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Récupère les séances de sport compatibles des `days` derniers jours, plus récentes d'abord. */
export async function fetchRecentWatchWorkouts(
  client: HealthClient,
  now: Date = new Date(),
  days = 7,
): Promise<WatchWorkout[]> {
  const { workouts } = await client.queryWorkouts({
    startDate: new Date(now.getTime() - days * DAY_MS).toISOString(),
    endDate: now.toISOString(),
    limit: 50,
    ascending: false,
  });

  const seen = new Set<string>();
  const pending: Promise<WatchWorkout>[] = [];
  for (const workout of workouts) {
    const converted = toWatchWorkout(workout);
    if (!converted || seen.has(converted.externalId)) continue;
    seen.add(converted.externalId);
    pending.push(withSourceTotals(client, converted, workout.sourceId));
  }

  const result = await Promise.all(pending);
  return result.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
