import type { CreateActivityInput } from '../entities/activity.js';

/**
 * Résultat du contrôle de validité d'une activité sportive.
 */
export interface ValidationResult {
  /** Indique si l'activité respecte les règles de légitimité physique */
  isValid: boolean;
  /** Motif de rejet en cas de détection d'anomalie ou de triche */
  reason?: string;
}

/**
 * Service de contrôle d'intégrité et anti-triche des activités sportives (Directives AGENTS.md).
 * 
 * Vérifie que la télémétrie soumise par le client mobile correspond à un effort humain plausible :
 * 1. Cohérence temporelle (début, fin, durée positive).
 * 2. Vélocité maximale autorisée (35 km/h pour la course/marche, 90 km/h pour le vélo).
 */
export class AntiCheatService {
  /** Plafond de vitesse moyenne pour la marche et la course à pied (35 km/h) */
  private static readonly MAX_SPEED_PEDESTRIAN_KMH = 35;
  /** Plafond de vitesse moyenne pour le cyclisme (90 km/h) */
  private static readonly MAX_SPEED_BIKE_KMH = 90;

  /**
   * Analyse et valide les métriques d'une activité sportive soumise.
   * 
   * @param input Données de l'activité soumise (temps, distance, coordonnées)
   * @returns Résultat de validation contenant le statut et la raison du rejet éventuel
   */
  validateActivity(input: CreateActivityInput): ValidationResult {
    // 1. Cohérence temporelle
    if (input.endedAt.getTime() < input.startedAt.getTime()) {
      return {
        isValid: false,
        reason: 'Temporal inconsistency: endedAt cannot precede startedAt',
      };
    }

    if (input.durationSeconds <= 0 && input.distanceMeters > 0) {
      return {
        isValid: false,
        reason: 'Temporal inconsistency: duration must be positive for non-zero distance',
      };
    }

    // 2. Contrôle du plafond de vitesse moyenne (AGENTS.md)
    if (input.durationSeconds > 0) {
      const speedMs = input.distanceMeters / input.durationSeconds;
      const speedKmh = speedMs * 3.6;

      const maxAllowedKmh =
        input.activityType === 'bike'
          ? AntiCheatService.MAX_SPEED_BIKE_KMH
          : AntiCheatService.MAX_SPEED_PEDESTRIAN_KMH;

      if (speedKmh > maxAllowedKmh) {
        return {
          isValid: false,
          reason: `Excessive speed: ${speedKmh.toFixed(1)} km/h exceeds maximum plausible limit of ${maxAllowedKmh} km/h for ${input.activityType}`,
        };
      }
    }

    return { isValid: true };
  }
}
