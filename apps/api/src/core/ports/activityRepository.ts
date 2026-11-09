import type { Activity } from '../entities/activity.js';

export interface IActivityRepository {
  create(activity: Activity): Promise<Activity>;
  findById(id: string): Promise<Activity | null>;
  findByPlayerId(playerId: string, limit?: number): Promise<Activity[]>;
}
