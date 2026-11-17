import type { ActivityRecording } from './activityRecording.js';
export type ActivityType = 'walk' | 'run' | 'bike' | 'hike';

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export type CoordinatePair = [longitude: number, latitude: number];

/** Magasin santé d'où une activité enregistrée par une montre a été importée. */
export type ExternalActivitySource = 'health-connect' | 'apple-health';

/** Référence d'une activité importée, unique par joueur (sert au dédoublonnage). */
export interface ExternalActivityRef {
  source: ExternalActivitySource;
  /** Identifiant de la séance dans le magasin santé (metadata ID / UUID HealthKit). */
  id: string;
  /** Montre ou appli d'origine si connue (ex. « Garmin Forerunner 255 »), pour l'affichage. */
  deviceName?: string;
}

export interface Activity {
  id: string;
  playerId: string;
  activityType: ActivityType;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  coordinates: CoordinatePair[];
  recording?: ActivityRecording;
  /** Présent si l'activité a été importée depuis une montre. */
  external?: ExternalActivityRef;
  createdAt: Date;
}

/** Activité sans tracé ni enregistrement brut : assez léger pour les statistiques d'une année. */
export type ActivitySummary = Omit<Activity, 'coordinates' | 'recording'>;

export interface CreateActivityInput {
  playerId: string;
  activityType: ActivityType;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters?: number;
  coordinates: CoordinatePair[];
  recording?: ActivityRecording;
  external?: ExternalActivityRef;
}
