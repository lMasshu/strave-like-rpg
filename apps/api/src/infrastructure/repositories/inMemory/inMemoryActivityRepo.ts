import type { Activity } from '../../../core/entities/activity.js';
import type { IActivityRepository } from '../../../core/ports/activityRepository.js';

export class InMemoryActivityRepository implements IActivityRepository {
  private readonly activities = new Map<string, Activity>();

  async create(activity: Activity): Promise<Activity> {
    this.activities.set(activity.id, { ...activity });
    return activity;
  }

  async findById(id: string): Promise<Activity | null> {
    const act = this.activities.get(id);
    return act ? { ...act } : null;
  }

  async findByPlayerId(playerId: string, limit = 20): Promise<Activity[]> {
    const list = Array.from(this.activities.values())
      .filter((a) => a.playerId === playerId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
    return list.map((a) => ({ ...a }));
  }
}
