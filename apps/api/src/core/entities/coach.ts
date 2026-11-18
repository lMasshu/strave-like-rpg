/** Résumé agrégé des activités de la semaine pour l'IA et l'affichage. */
export interface CoachWeeklySummary {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  activityCount: number;
  elevationGainMeters: number;
}

/** Bilan hebdomadaire mis en cache en base de données (1 par semaine par joueur). */
export interface CoachWeeklyReport {
  id: string;
  playerId: string;
  year: number;
  weekNumber: number;
  summary: CoachWeeklySummary;
  reportText: string;
  createdAt: Date;
}

export type NewCoachWeeklyReport = Omit<CoachWeeklyReport, 'id' | 'createdAt'>;

export type CoachMessageRole = 'user' | 'assistant';

/** Message échangé avec le Maître de Guilde. */
export interface CoachMessage {
  id: string;
  playerId: string;
  role: CoachMessageRole;
  content: string;
  createdAt: Date;
}

export type NewCoachMessage = Omit<CoachMessage, 'id' | 'createdAt'>;
