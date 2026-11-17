import { Health } from "@capgo/capacitor-health";
import type { WatchLinkStatus, WatchWorkout } from "../data/watchLink";
import { watchDeviceLabel } from "./watchDevice";
import {
  ActivityAlreadyImportedError,
  ApiError,
  apiClient,
  ExternalActivityRef,
  SaveActivityDto,
} from "./apiClient";
import {
  fetchRecentWatchWorkouts,
  getWatchLinkStatus,
  HealthClient,
} from "./watchLink";

/** Mémoire locale des séances déjà traitées, pour ne pas les renvoyer à chaque synchro. */
export interface ImportedWorkoutStore {
  has(externalId: string): boolean;
  add(externalId: string): void;
}

export interface WatchSyncResult {
  /** `skipped` : montre non liée ou magasin santé indisponible. */
  state: "synced" | "skipped";
  imported: number;
  /** Déjà présentes côté API (HTTP 409) ou refusées par l'anti-triche (HTTP 4xx). */
  ignored: number;
  /** Échecs temporaires (réseau, serveur) : seront retentés à la prochaine synchro. */
  failed: number;
}

export interface WatchSyncDeps {
  health: HealthClient;
  save: (dto: SaveActivityDto) => Promise<unknown>;
  store: ImportedWorkoutStore;
  now?: Date;
}

/** Health Connect limite la lecture à 30 jours sans permission d'historique. */
export const SYNC_WINDOW_DAYS = 30;

function sourceFor(
  platform: WatchLinkStatus["platform"],
): ExternalActivityRef["source"] {
  return platform === "ios" ? "apple-health" : "health-connect";
}

/** Convertit une séance de montre en activité à enregistrer (sans tracé GPS). */
export function toSaveActivityDto(
  workout: WatchWorkout,
  source: ExternalActivityRef["source"],
): SaveActivityDto {
  const deviceName = watchDeviceLabel(workout.sourceName);
  return {
    activityType: workout.activityType,
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    durationSeconds: workout.durationSeconds,
    distanceMeters: Math.round(workout.distanceMeters ?? 0),
    elevationGainMeters: 0,
    coordinates: [],
    external: {
      source,
      id: workout.externalId,
      ...(deviceName ? { deviceName } : {}),
    },
  };
}

function isPermanentRejection(error: unknown): boolean {
  return (
    error instanceof ActivityAlreadyImportedError ||
    (error instanceof ApiError && error.status >= 400 && error.status < 500)
  );
}

/**
 * Envoie à l'API les séances de montre pas encore importées.
 * Séquentiel pour ne pas saturer l'API ; s'arrête au premier échec réseau/serveur
 * (les suivantes échoueraient aussi) et laisse ces séances pour la prochaine fois.
 */
export async function syncWatchWorkouts({
  health,
  save,
  store,
  now = new Date(),
}: WatchSyncDeps): Promise<WatchSyncResult> {
  const result: WatchSyncResult = {
    state: "skipped",
    imported: 0,
    ignored: 0,
    failed: 0,
  };

  const status = await getWatchLinkStatus(health);
  if (status.state !== "linked") return result;
  result.state = "synced";

  const workouts = await fetchRecentWatchWorkouts(
    health,
    now,
    SYNC_WINDOW_DAYS,
  );
  const pending = workouts
    .filter((workout) => !store.has(workout.externalId))
    // Les plus anciennes d'abord, pour que l'XP soit créditée dans l'ordre des sorties.
    .reverse();
  const source = sourceFor(status.platform);

  for (let i = 0; i < pending.length; i += 1) {
    const workout = pending[i];
    try {
      await save(toSaveActivityDto(workout, source));
      store.add(workout.externalId);
      result.imported += 1;
    } catch (error) {
      if (isPermanentRejection(error)) {
        store.add(workout.externalId);
        result.ignored += 1;
      } else {
        result.failed = pending.length - i;
        break;
      }
    }
  }

  return result;
}

/** Une liste par compte : un autre joueur sur le même téléphone importe ses propres séances. */
export function importedStoreKey(playerId: string): string {
  return `stride_imported_watch_workouts:${playerId}`;
}
/** Au-delà, les plus anciens identifiants sortent de toute façon de la fenêtre de 30 jours. */
const STORE_MAX_IDS = 500;

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Accès bloqué (navigation privée, stockage désactivé)
  }
}

/** Stockage local des identifiants importés ; dégrade sans erreur si le stockage est indisponible. */
export function createLocalImportedStore(
  playerId: string,
  storage: Storage | null = defaultStorage(),
): ImportedWorkoutStore {
  const key = importedStoreKey(playerId);
  let ids: string[] = [];
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(key) ?? "[]");
    if (Array.isArray(parsed)) {
      ids = parsed.filter((id): id is string => typeof id === "string");
    }
  } catch {
    ids = [];
  }
  const known = new Set(ids);

  return {
    has: (externalId) => known.has(externalId),
    add: (externalId) => {
      if (known.has(externalId)) return;
      known.add(externalId);
      ids = [...ids, externalId].slice(-STORE_MAX_IDS);
      try {
        storage?.setItem(key, JSON.stringify(ids));
      } catch {
        // Stockage plein ou bloqué : l'API refusera les doublons (409) de toute façon.
      }
    },
  };
}

/**
 * Synchro avec les dépendances réelles (plugin santé, API, localStorage) pour le
 * joueur connecté ; la session est jointe automatiquement par `apiClient`.
 */
export function importWatchWorkouts(
  playerId: string,
): Promise<WatchSyncResult> {
  return syncWatchWorkouts({
    health: Health,
    save: (dto) => apiClient.saveActivity(dto),
    store: createLocalImportedStore(playerId),
  });
}
