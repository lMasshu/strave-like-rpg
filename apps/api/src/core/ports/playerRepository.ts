import type { CoachGoal, NewPlayer, Player } from '../entities/player.js';

/** Levée par `create` quand l'e-mail ou le pseudo est déjà pris (contrainte d'unicité). */
export class PlayerConflictError extends Error {
  constructor(readonly field: 'email' | 'username' | 'auth0Sub') {
    super(`Player ${field} already exists`);
    this.name = 'PlayerConflictError';
  }
}

export interface IPlayerRepository {
  findById(id: string): Promise<Player | null>;
  /** Recherche insensible à la casse. */
  findByEmail(email: string): Promise<Player | null>;
  findByUsername(username: string): Promise<Player | null>;
  findByAuth0Sub(auth0Sub: string): Promise<Player | null>;
  /** @throws PlayerConflictError si l'e-mail, le pseudo ou l'identifiant Auth0 existe déjà */
  create(player: NewPlayer): Promise<Player>;
  /** Associe un compte Google (Auth0) à un compte existant. */
  linkAuth0Sub(id: string, auth0Sub: string): Promise<Player>;
  /**
   * Ajoute de l'XP de façon atomique et recalcule le niveau côté stockage
   * (jamais de lecture puis écriture côté application, cf. AGENTS.md).
   */
  addExperience(id: string, xpDelta: number): Promise<Player>;
  /** Met à jour les préférences relatives au Maître de Guilde (activation et objectif). */
  updateCoachSettings(
    id: string,
    settings: { coachEnabled?: boolean; coachGoal?: CoachGoal },
  ): Promise<Player>;
}
