import { randomUUID } from 'node:crypto';
import { validateRecording } from './recordingValidation.js';
import type { Activity, CreateActivityInput } from '../entities/activity.js';
import {
  DuplicateActivityError,
  type IActivityRepository,
} from '../ports/activityRepository.js';
import type { IPlayerRepository } from '../ports/playerRepository.js';
import type { IEventPublisher } from '../ports/eventPublisher.js';
import type { AntiCheatService } from './antiCheatService.js';

/**
 * Résultat du traitement d'une activité sportive terminée.
 */
export interface RecordActivityResult {
  /** Activité enregistrée */
  activity: Activity;
  /** Points d'expérience gagnés lors de cette sortie */
  xpEarned: number;
  /** Niveau du joueur avant la sortie */
  previousLevel: number;
  /** Niveau du joueur après application de l'XP */
  newLevel: number;
  /** Indique si le joueur a franchi un palier de niveau */
  levelUp: boolean;
  /** Total cumulé d'expérience du joueur */
  totalExperience: number;
}

export { DuplicateActivityError };

/**
 * Service orchestrant l'enregistrement des courses et la progression RPG.
 *
 * 1. Filtre la sortie via l'AntiCheatService.
 * 2. Calcule le gain d'XP (100 XP/km + 2 XP/m D+).
 * 3. Met à jour le niveau du joueur.
 * 4. Persiste l'activité dans le repository.
 * 5. Diffuse un événement 'activity.completed' sur le bus RabbitMQ pour les workers de raid.
 */
export class ActivityService {
  constructor(
    private readonly activityRepo: IActivityRepository,
    private readonly playerRepo: IPlayerRepository,
    private readonly eventPublisher: IEventPublisher,
    private readonly antiCheat: AntiCheatService,
  ) {}

  /**
   * Enregistre une activité sportive, applique la progression RPG et publie l'effort.
   *
   * @throws DuplicateActivityError si la séance de montre a déjà été importée
   * @throws Error si l'anti-triche échoue ou si le joueur n'existe pas
   */
  async recordActivity(
    input: CreateActivityInput,
  ): Promise<RecordActivityResult> {
    // 0. Dédoublonnage des imports de montre (avant tout gain d'XP).
    // La contrainte UNIQUE de la table `activities` reste le garde-fou en cas d'envois simultanés.
    if (input.external) {
      const existing = await this.activityRepo.findByExternalRef(
        input.playerId,
        input.external,
      );
      if (existing) throw new DuplicateActivityError(existing.id);
    }

    const recordingValidation = validateRecording(input);
    if (!recordingValidation.isValid)
      throw new Error(recordingValidation.reason);
    // 1. Contrôle Anti-triche
    const validation = this.antiCheat.validateActivity(input);
    if (!validation.isValid) {
      throw new Error(`Anti-cheat validation failed: ${validation.reason}`);
    }

    // 2. Récupération du joueur
    const player = await this.playerRepo.findById(input.playerId);
    if (!player) {
      throw new Error(`Player ${input.playerId} not found`);
    }

    // 3. Calcul de l'XP
    // 100 XP par km (10m = 1 XP) + 2 XP par mètre de D+
    const distanceXp = Math.floor(input.distanceMeters / 10);
    const elevationXp = Math.floor((input.elevationGainMeters || 0) * 2);
    const xpEarned = distanceXp + elevationXp;

    // 4. Persistance de l'activité AVANT le gain d'XP : si la base refuse un doublon
    // (contrainte UNIQUE sur la séance de montre), aucune XP n'est créditée.
    const activity: Activity = {
      id: randomUUID(),
      playerId: input.playerId,
      activityType: input.activityType,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationSeconds: input.durationSeconds,
      distanceMeters: input.distanceMeters,
      elevationGainMeters: input.elevationGainMeters || 0,
      coordinates: input.coordinates,
      ...(input.recording ? { recording: input.recording } : {}),
      ...(input.external ? { external: input.external } : {}),
      createdAt: new Date(),
    };

    const savedActivity = await this.activityRepo.create(activity);

    // 5. Gain d'XP atomique côté stockage (pas de lecture puis écriture concurrente)
    const previousLevel = player.level;
    const updatedPlayer = await this.playerRepo.addExperience(player.id, xpEarned);
    const newLevel = updatedPlayer.level;
    const levelUp = newLevel > previousLevel;
    const newTotalExperience = updatedPlayer.experience;

    // 6. Publication sur le broker de messages (RabbitMQ)
    await this.eventPublisher.publish('activity.completed', {
      activityId: savedActivity.id,
      playerId: savedActivity.playerId,
      activityType: savedActivity.activityType,
      distanceMeters: savedActivity.distanceMeters,
      durationSeconds: savedActivity.durationSeconds,
      elevationGainMeters: savedActivity.elevationGainMeters,
      xpEarned,
      newLevel,
      timestamp: savedActivity.endedAt.toISOString(),
    });

    return {
      activity: savedActivity,
      xpEarned,
      previousLevel,
      newLevel,
      levelUp,
      totalExperience: newTotalExperience,
    };
  }

  /**
   * Récupère l'historique des activités d'un joueur, triées par date décroissante.
   */
  async getPlayerActivities(playerId: string, limit = 20): Promise<Activity[]> {
    return this.activityRepo.findByPlayerId(playerId, limit);
  }

  /**
   * Récupère le détail d'une activité par son identifiant unique.
   */
  async getActivityById(id: string): Promise<Activity | null> {
    return this.activityRepo.findById(id);
  }
}
