import { randomUUID } from 'node:crypto';
import type { Activity, CreateActivityInput } from '../entities/activity.js';
import { calculateLevel } from '../entities/player.js';
import type { IActivityRepository } from '../ports/activityRepository.js';
import type { IPlayerRepository } from '../ports/playerRepository.js';
import type { IEventPublisher } from '../ports/eventPublisher.js';
import type { AntiCheatService } from './antiCheatService.js';

export interface RecordActivityResult {
  activity: Activity;
  xpEarned: number;
  previousLevel: number;
  newLevel: number;
  levelUp: boolean;
  totalExperience: number;
}

export class ActivityService {
  constructor(
    private readonly activityRepo: IActivityRepository,
    private readonly playerRepo: IPlayerRepository,
    private readonly eventPublisher: IEventPublisher,
    private readonly antiCheat: AntiCheatService,
  ) {}

  async recordActivity(input: CreateActivityInput): Promise<RecordActivityResult> {
    // 1. Anti-cheat validation
    const validation = this.antiCheat.validateActivity(input);
    if (!validation.isValid) {
      throw new Error(`Anti-cheat validation failed: ${validation.reason}`);
    }

    // 2. Fetch Player
    const player = await this.playerRepo.findById(input.playerId);
    if (!player) {
      throw new Error(`Player ${input.playerId} not found`);
    }

    // 3. Compute XP
    // 100 XP per 1000m (10m = 1 XP) + 2 XP per meter elevation gain
    const distanceXp = Math.floor(input.distanceMeters / 10);
    const elevationXp = Math.floor((input.elevationGainMeters || 0) * 2);
    const xpEarned = distanceXp + elevationXp;

    const previousLevel = player.level;
    const newTotalExperience = player.experience + xpEarned;
    const { level: newLevel } = calculateLevel(newTotalExperience);
    const levelUp = newLevel > previousLevel;

    // 4. Update Player
    await this.playerRepo.updateExperienceAndLevel(player.id, newTotalExperience, newLevel);

    // 5. Persist Activity
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
      createdAt: new Date(),
    };

    const savedActivity = await this.activityRepo.create(activity);

    // 6. Publish Event to Message Broker (RabbitMQ)
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

  async getPlayerActivities(playerId: string, limit = 20): Promise<Activity[]> {
    return this.activityRepo.findByPlayerId(playerId, limit);
  }

  async getActivityById(id: string): Promise<Activity | null> {
    return this.activityRepo.findById(id);
  }
}
