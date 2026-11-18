import type {
  CoachMessage,
  CoachWeeklyReport,
  NewCoachMessage,
  NewCoachWeeklyReport,
} from '../entities/coach.js';

export interface ICoachRepository {
  /** Récupère le bilan d'une semaine précise pour un joueur, sinon `null`. */
  getWeeklyReport(
    playerId: string,
    year: number,
    weekNumber: number,
  ): Promise<CoachWeeklyReport | null>;

  /** Enregistre un bilan hebdomadaire (ou met à jour s'il existe déjà pour la même semaine). */
  saveWeeklyReport(report: NewCoachWeeklyReport): Promise<CoachWeeklyReport>;

  /** Récupère les messages les plus récents (ordre antéchronologique : plus récents en premier). */
  getRecentMessages(playerId: string, limit?: number): Promise<CoachMessage[]>;

  /** Enregistre un nouveau message dans la conversation avec le Maître de Guilde. */
  saveMessage(message: NewCoachMessage): Promise<CoachMessage>;

  /** Purge les messages anciens au-delà des `keepCount` plus récents pour ce joueur. */
  purgeOldMessages(playerId: string, keepCount?: number): Promise<void>;
}
