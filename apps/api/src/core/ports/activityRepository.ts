import type { Activity, ExternalActivityRef } from '../entities/activity.js';

/**
 * Levée quand une séance de montre a déjà été importée par ce joueur.
 * Aucune XP n'est recréditée.
 */
export class DuplicateActivityError extends Error {
  constructor(readonly existingActivityId: string) {
    super('Activity already imported');
    this.name = 'DuplicateActivityError';
  }
}

export interface IActivityRepository {
  /** @throws DuplicateActivityError si la même séance de montre est déjà enregistrée pour ce joueur */
  create(activity: Activity): Promise<Activity>;
  findById(id: string): Promise<Activity | null>;
  findByPlayerId(playerId: string, limit?: number): Promise<Activity[]>;
  /** Activité déjà importée par ce joueur depuis la même séance de montre, sinon `null`. */
  findByExternalRef(
    playerId: string,
    ref: ExternalActivityRef,
  ): Promise<Activity | null>;
}
