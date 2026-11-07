import type { CreateActivityInput } from '../entities/activity.js';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export class AntiCheatService {
  // Speed limits in km/h based on AGENTS.md rules
  private static readonly MAX_SPEED_PEDESTRIAN_KMH = 35;
  private static readonly MAX_SPEED_BIKE_KMH = 90;

  validateActivity(input: CreateActivityInput): ValidationResult {
    // 1. Temporal consistency
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

    // 2. Average velocity limit (AGENTS.md)
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
