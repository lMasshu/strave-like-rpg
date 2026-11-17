/** Sports Stride Quest sait convertir en activité (aligné sur `activities.activity_type`). */
export type WatchActivityType = "walk" | "run" | "bike" | "hike";

/**
 * État de la liaison entre l'appli et le magasin santé du téléphone
 * (Health Connect sur Android, Apple Santé sur iOS).
 * - `unavailable` : magasin absent (navigateur, Health Connect non installé...).
 * - `not-linked` : magasin présent mais lecture des séances non autorisée.
 * - `linked` : lecture des séances autorisée.
 */
export type WatchLinkState = "unavailable" | "not-linked" | "linked";

export interface WatchLinkStatus {
  state: WatchLinkState;
  /** Plateforme native détectée, `null` hors appli native. */
  platform: "android" | "ios" | "web" | null;
  /** La fréquence cardiaque est lisible en plus des séances. */
  heartRateAuthorized: boolean;
  /** Raison technique quand le magasin santé est indisponible. */
  reason?: string;
}

/** Séance enregistrée par une montre et lue depuis le magasin santé. */
export interface WatchWorkout {
  /** Identifiant stable fourni par Health Connect / HealthKit (sert au dédoublonnage). */
  externalId: string;
  activityType: WatchActivityType;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number | null;
  caloriesKcal: number | null;
  /** Appli source telle que rapportée par le magasin santé (ex. « Garmin Connect »). */
  sourceName: string | null;
}
