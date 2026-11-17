import type {
  Activity,
  ExternalActivityRef,
} from '../../../core/entities/activity.js';
import {
  DuplicateActivityError,
  type IActivityRepository,
} from '../../../core/ports/activityRepository.js';

export class InMemoryActivityRepository implements IActivityRepository {
  private readonly activities = new Map<string, Activity>();

  async create(activity: Activity): Promise<Activity> {
    if (activity.external) {
      const existing = await this.findByExternalRef(activity.playerId, activity.external);
      if (existing) throw new DuplicateActivityError(existing.id);
    }
    this.activities.set(activity.id, structuredClone(activity));
    return structuredClone(activity);
  }

  async findById(id: string): Promise<Activity | null> {
    const act = this.activities.get(id);
    return act ? structuredClone(act) : null;
  }

  async findByPlayerId(playerId: string, limit = 20): Promise<Activity[]> {
    const list = Array.from(this.activities.values())
      .filter((a) => a.playerId === playerId)
      // Plus récente en premier ; à départ identique, la dernière enregistrée d'abord.
      .sort(
        (a, b) =>
          b.startedAt.getTime() - a.startedAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .slice(0, limit);
    return list.map((a) => structuredClone(a));
  }

  async findByExternalRef(
    playerId: string,
    ref: ExternalActivityRef,
  ): Promise<Activity | null> {
    for (const activity of this.activities.values()) {
      if (
        activity.playerId === playerId &&
        activity.external?.source === ref.source &&
        activity.external.id === ref.id
      ) {
        return structuredClone(activity);
      }
    }
    return null;
  }
}
